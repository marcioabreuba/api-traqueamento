/**
 * Script para corrigir problemas com a base de dados GeoIP
 * 
 * Este script:
 * 1. Faz um backup da base atual
 * 2. Baixa uma nova cópia da base GeoLite2-City
 * 3. Valida a integridade da nova base
 * 4. Substitui a base apenas se a validação for bem-sucedida
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');
const extract = require('extract-zip');
const tar = require('tar');
const dotenv = require('dotenv');
const { Reader } = require('@maxmind/geoip2-node');
const crypto = require('crypto');

// Carregar variáveis de ambiente
dotenv.config({ path: path.join(__dirname, '../.env') });

// Constantes e configurações
const MAXMIND_ACCOUNT_ID = process.env.MAXMIND_ACCOUNT_ID;
const MAXMIND_LICENSE_KEY = process.env.MAXMIND_LICENSE_KEY;
const TARGET_DIR = path.join(__dirname, '../data');
const DATABASE_FILENAME = 'GeoLite2-City.mmdb';
const TARGET_PATH = path.join(TARGET_DIR, DATABASE_FILENAME);
const BACKUP_PATH = path.join(TARGET_DIR, `${DATABASE_FILENAME}.bak`);
const TEMP_TAR_FILE = path.resolve(TARGET_DIR, 'geolite2-city.tar.gz');
const TEMP_EXTRACT_DIR = path.resolve(TARGET_DIR, 'temp_extract');

// Helpers para operações de arquivo assíncronas
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const mkdirAsync = promisify(fs.mkdir);
const rmdirAsync = promisify(fs.rmdir);
const copyFileAsync = promisify(fs.copyFile);

/**
 * Verifica a integridade da base de dados GeoIP
 * @param {string} dbPath - Caminho para o arquivo da base de dados
 * @returns {Promise<boolean>} Verdadeiro se a base estiver íntegra
 */
async function verificarIntegridadeBase(dbPath) {
  console.log(`Verificando integridade da base em: ${dbPath}`);
  
  // Verificar se o arquivo existe
  if (!fs.existsSync(dbPath)) {
    console.error('❌ Arquivo não encontrado');
    return false;
  }
  
  // Verificar tamanho do arquivo
  const stats = fs.statSync(dbPath);
  const fileSize = stats.size;
  console.log(`Tamanho da base: ${fileSize} bytes`);
  
  if (fileSize < 10000000) {
    console.error('❌ Arquivo muito pequeno para ser uma base GeoIP válida');
    return false;
  }
  
  // Verificar permissões de leitura
  try {
    fs.accessSync(dbPath, fs.constants.R_OK);
    console.log('✅ Arquivo tem permissões de leitura');
  } catch (error) {
    console.error(`❌ Erro de permissões: ${error.message}`);
    return false;
  }
  
  // Tentar carregar a base na memória
  let dbBuffer = null;
  try {
    console.log('Lendo arquivo para a memória...');
    dbBuffer = fs.readFileSync(dbPath);
    console.log(`✅ Arquivo lido com sucesso (${dbBuffer.length} bytes)`);
  } catch (error) {
    console.error(`❌ Erro ao ler arquivo: ${error.message}`);
    return false;
  }
  
  // Tentar abrir a base com a biblioteca
  let reader = null;
  try {
    console.log('Abrindo a base de dados...');
    reader = Reader.openBuffer(dbBuffer);
    console.log('✅ Base de dados aberta com sucesso');
  } catch (error) {
    console.error(`❌ Erro ao abrir base de dados: ${error.message}`);
    return false;
  }
  
  // Lista de IPs para teste
  const testIPs = [
    { value: '8.8.8.8', description: 'Google DNS (IPv4)' },
    { value: '1.1.1.1', description: 'Cloudflare DNS (IPv4)' },
    { value: '2001:4860:4860::8888', description: 'Google DNS (IPv6)' },
    { value: '2606:4700:4700::1111', description: 'Cloudflare DNS (IPv6)' }
  ];
  
  // Testar consultas a IPs conhecidos
  let testsFailed = 0;
  let testsPassed = 0;
  
  for (const ip of testIPs) {
    console.log(`\nTestando IP: ${ip.description} (${ip.value})`);
    try {
      const result = reader.city(ip.value);
      // Verificar apenas se recebemos um objeto de resultado válido
      if (result && typeof result === 'object') {
        console.log(`✅ Consulta bem-sucedida para ${ip.value}`);
        testsPassed++;
        
        // Verificar campos críticos
        const hasCountry = result.country && result.country.names;
        const hasLocation = result.location && (
          typeof result.location.latitude === 'number' || 
          typeof result.location.longitude === 'number'
        );
        
        if (!hasCountry || !hasLocation) {
          console.log(`⚠️ Consulta retornou dados incompletos para ${ip.value}`);
          testsFailed++;
        }
      } else {
        console.log(`⚠️ Resultado vazio para ${ip.value}`);
        testsFailed++;
      }
    } catch (error) {
      console.error(`❌ Erro ao consultar ${ip.value}: ${error.message}`);
      if (error.message.includes('Unknown type NaN at offset')) {
        console.error('  PROBLEMA DETECTADO: Corrupção na estrutura interna da base');
      }
      testsFailed++;
    }
  }
  
  // Resultado final
  console.log('\n=== RESULTADO DA VERIFICAÇÃO ===');
  console.log(`Total de testes: ${testsPassed + testsFailed}`);
  console.log(`Testes bem-sucedidos: ${testsPassed}`);
  console.log(`Testes com falha: ${testsFailed}`);
  
  if (testsFailed === 0 && testsPassed > 0) {
    console.log('✅✅✅ Base de dados íntegra e funcional');
    return true;
  } else if (testsPassed > 0) {
    console.log('⚠️⚠️⚠️ Base de dados parcialmente funcional (alguns testes falharam)');
    return testsPassed > testsFailed; // Considera válida se a maioria dos testes passou
  } else {
    console.log('❌❌❌ Base de dados corrompida ou incompatível');
    return false;
  }
}

/**
 * Baixa a base de dados do MaxMind
 */
async function downloadDatabase() {
  console.log('=== BAIXANDO NOVA BASE DE DADOS ===');
  
  // Verificar credenciais
  if (!MAXMIND_ACCOUNT_ID || !MAXMIND_LICENSE_KEY) {
    console.error('❌ Erro: MAXMIND_ACCOUNT_ID e MAXMIND_LICENSE_KEY são necessários no arquivo .env');
    return false;
  }
  
  // Montar URL de download
  const EDITION_ID = 'GeoLite2-City';
  const downloadUrl = `https://download.maxmind.com/app/geoip_download?edition_id=${EDITION_ID}&license_key=${MAXMIND_LICENSE_KEY}&suffix=tar.gz`;
  
  try {
    console.log('Iniciando download da base de dados...');
    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'arraybuffer',
      maxRedirects: 5
    });
    
    // Verificar se o diretório de destino existe
    if (!fs.existsSync(TARGET_DIR)) {
      await mkdirAsync(TARGET_DIR, { recursive: true });
      console.log(`Diretório criado: ${TARGET_DIR}`);
    }
    
    // Salvar arquivo baixado
    await writeFileAsync(TEMP_TAR_FILE, Buffer.from(response.data));
    console.log(`Download concluído: ${TEMP_TAR_FILE} (${response.data.length} bytes)`);
    
    // Calcular checksum do arquivo
    const fileHash = crypto.createHash('md5').update(response.data).digest('hex');
    console.log(`Checksum (MD5): ${fileHash}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Erro no download: ${error.message}`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
    }
    return false;
  }
}

/**
 * Extrai arquivo tar.gz baixado
 */
async function extractDatabase() {
  console.log('=== EXTRAINDO ARQUIVO ===');
  
  if (!fs.existsSync(TEMP_TAR_FILE)) {
    console.error(`❌ Arquivo de download não encontrado: ${TEMP_TAR_FILE}`);
    return false;
  }
  
  try {
    // Criar diretório temporário para extração
    if (fs.existsSync(TEMP_EXTRACT_DIR)) {
      console.log(`Removendo diretório temporário existente: ${TEMP_EXTRACT_DIR}`);
      fs.rmSync(TEMP_EXTRACT_DIR, { recursive: true, force: true });
    }
    
    await mkdirAsync(TEMP_EXTRACT_DIR, { recursive: true });
    console.log(`Diretório de extração criado: ${TEMP_EXTRACT_DIR}`);
    
    // Extrair arquivo
    console.log(`Extraindo ${TEMP_TAR_FILE}...`);
    await tar.extract({
      file: TEMP_TAR_FILE,
      cwd: TEMP_EXTRACT_DIR
    });
    
    console.log('Extração concluída');
    return true;
  } catch (error) {
    console.error(`❌ Erro ao extrair arquivo: ${error.message}`);
    return false;
  }
}

/**
 * Localiza o arquivo .mmdb extraído
 */
async function findMmdbFile() {
  console.log('=== LOCALIZANDO ARQUIVO MMDB ===');
  
  if (!fs.existsSync(TEMP_EXTRACT_DIR)) {
    console.error(`❌ Diretório de extração não encontrado: ${TEMP_EXTRACT_DIR}`);
    return null;
  }
  
  try {
    // Função recursiva para encontrar arquivos com extensão .mmdb
    const findMmdbFiles = (dir) => {
      let results = [];
      const list = fs.readdirSync(dir);
      
      list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          // Recursive case: se for diretório, procurar dentro dele
          results = results.concat(findMmdbFiles(filePath));
        } else if (path.extname(file) === '.mmdb') {
          // Base case: encontrou um arquivo .mmdb
          results.push(filePath);
        }
      });
      
      return results;
    };
    
    // Encontrar todos os arquivos .mmdb no diretório de extração
    const mmdbFiles = findMmdbFiles(TEMP_EXTRACT_DIR);
    
    if (mmdbFiles.length === 0) {
      console.error('❌ Nenhum arquivo .mmdb encontrado após extração');
      return null;
    }
    
    // Filtrar apenas para GeoLite2-City.mmdb
    const targetFile = mmdbFiles.find(file => path.basename(file) === DATABASE_FILENAME);
    
    if (targetFile) {
      console.log(`✅ Arquivo encontrado: ${targetFile}`);
      return targetFile;
    } else {
      // Se não encontrar o arquivo exato, usar o primeiro .mmdb encontrado
      console.log(`⚠️ Arquivo específico não encontrado, usando: ${mmdbFiles[0]}`);
      return mmdbFiles[0];
    }
  } catch (error) {
    console.error(`❌ Erro ao procurar arquivo: ${error.message}`);
    return null;
  }
}

/**
 * Substitui a base de dados atual pela nova
 */
async function replaceDatabase(newDbPath) {
  console.log('=== SUBSTITUINDO BASE DE DADOS ===');
  
  if (!fs.existsSync(newDbPath)) {
    console.error(`❌ Novo arquivo não encontrado: ${newDbPath}`);
    return false;
  }
  
  try {
    // Fazer backup da base atual se existir
    if (fs.existsSync(TARGET_PATH)) {
      console.log(`Fazendo backup da base atual para: ${BACKUP_PATH}`);
      await copyFileAsync(TARGET_PATH, BACKUP_PATH);
    }
    
    // Copiar nova base para o destino
    console.log(`Copiando nova base para: ${TARGET_PATH}`);
    await copyFileAsync(newDbPath, TARGET_PATH);
    
    console.log('✅ Base de dados substituída com sucesso');
    return true;
  } catch (error) {
    console.error(`❌ Erro ao substituir base de dados: ${error.message}`);
    return false;
  }
}

/**
 * Limpa arquivos temporários
 */
async function cleanup() {
  console.log('=== LIMPANDO ARQUIVOS TEMPORÁRIOS ===');
  
  try {
    // Remover arquivo de download
    if (fs.existsSync(TEMP_TAR_FILE)) {
      await unlinkAsync(TEMP_TAR_FILE);
      console.log(`Arquivo removido: ${TEMP_TAR_FILE}`);
    }
    
    // Remover diretório de extração
    if (fs.existsSync(TEMP_EXTRACT_DIR)) {
      fs.rmSync(TEMP_EXTRACT_DIR, { recursive: true, force: true });
      console.log(`Diretório removido: ${TEMP_EXTRACT_DIR}`);
    }
    
    console.log('✅ Limpeza concluída');
    return true;
  } catch (error) {
    console.error(`⚠️ Erro ao limpar arquivos temporários: ${error.message}`);
    return false;
  }
}

/**
 * Processo principal de correção da base
 */
async function main() {
  console.log('======================================');
  console.log('CORREÇÃO DA BASE DE DADOS GEOIP');
  console.log('======================================\n');
  
  // Verificar base atual
  console.log('\n>> VERIFICANDO BASE ATUAL');
  const baseAtualOk = await verificarIntegridadeBase(TARGET_PATH);
  
  if (baseAtualOk) {
    console.log('\n✅ Base atual está íntegra e funcional!');
    console.log('Deseja continuar mesmo assim? (S/N)');
    console.log('Como está executando em modo automatizado, consideraremos "S".');
  }
  
  // Download da nova base
  console.log('\n>> BAIXANDO NOVA BASE');
  const downloadOk = await downloadDatabase();
  if (!downloadOk) {
    console.error('\n❌ Falha no download. Abortando correção.');
    return;
  }
  
  // Extrair arquivos
  console.log('\n>> EXTRAINDO ARQUIVOS');
  const extractOk = await extractDatabase();
  if (!extractOk) {
    console.error('\n❌ Falha na extração. Abortando correção.');
    await cleanup();
    return;
  }
  
  // Localizar arquivo .mmdb
  console.log('\n>> LOCALIZANDO ARQUIVO MMDB');
  const newDbPath = await findMmdbFile();
  if (!newDbPath) {
    console.error('\n❌ Arquivo não localizado. Abortando correção.');
    await cleanup();
    return;
  }
  
  // Verificar integridade da nova base
  console.log('\n>> VERIFICANDO NOVA BASE');
  const novaBaseOk = await verificarIntegridadeBase(newDbPath);
  if (!novaBaseOk) {
    console.error('\n❌ Nova base não passou na verificação de integridade. Abortando correção.');
    await cleanup();
    return;
  }
  
  // Substituir base de dados
  console.log('\n>> SUBSTITUINDO BASE DE DADOS');
  const replaceOk = await replaceDatabase(newDbPath);
  if (!replaceOk) {
    console.error('\n❌ Falha ao substituir base de dados.');
    await cleanup();
    return;
  }
  
  // Verificar nova base instalada
  console.log('\n>> VERIFICANDO BASE INSTALADA');
  const baseInstaladaOk = await verificarIntegridadeBase(TARGET_PATH);
  if (!baseInstaladaOk) {
    console.error('\n❌ Base instalada não passou na verificação final. Restaurando backup...');
    
    // Restaurar backup
    if (fs.existsSync(BACKUP_PATH)) {
      try {
        await copyFileAsync(BACKUP_PATH, TARGET_PATH);
        console.log('✅ Backup restaurado com sucesso.');
      } catch (error) {
        console.error(`❌ Erro ao restaurar backup: ${error.message}`);
      }
    }
  } else {
    console.log('\n✅ Base instalada verificada com sucesso!');
  }
  
  // Limpar arquivos temporários
  console.log('\n>> LIMPANDO ARQUIVOS TEMPORÁRIOS');
  await cleanup();
  
  console.log('\n======================================');
  console.log(baseInstaladaOk ? '✅ CORREÇÃO CONCLUÍDA COM SUCESSO' : '❌ CORREÇÃO FALHOU');
  console.log('======================================');
}

// Executar processo principal
main().catch(console.error); 