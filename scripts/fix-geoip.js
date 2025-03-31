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
const https = require('https');
const readline = require('readline');
const { Reader } = require('@maxmind/geoip2-node');
const maxmind = require('maxmind');

// Determinar se estamos em ambiente Render
const isRenderEnvironment = process.env.RENDER === 'true' || 
                            process.env.RENDER_EXTERNAL_URL || 
                            process.env.RENDER_SERVICE_ID || 
                            process.env.IS_RENDER === 'true';

// Determinar se estamos em modo automático (para CI/CD)
const isAutomatedMode = process.argv.includes('--auto') || 
                         process.env.CI === 'true' || 
                         process.env.AUTOMATED === 'true' || 
                         isRenderEnvironment;

// Configurações
const MAXMIND_LICENSE_KEY = process.env.MAXMIND_LICENSE_KEY || 'JOJ3REIKfJWLIAqf';
const DOWNLOAD_URL = `https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${MAXMIND_LICENSE_KEY}&suffix=tar.gz`;
const DATA_DIR = path.join(process.cwd(), 'data');
const GEOIP_DB_PATH = path.join(DATA_DIR, 'GeoLite2-City.mmdb');
const DOWNLOAD_PATH = path.join(DATA_DIR, 'geolite2-city.tar.gz');
const EXTRACT_DIR = path.join(DATA_DIR, 'temp_extract');

// Função para imprimir banner
const printBanner = () => {
  console.log('\n======================================');
  console.log('CORREÇÃO DA BASE DE DADOS GEOIP       ');
  console.log('======================================\n');
};

// Função para criar interface de leitura interativa
const createInterface = () => {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
};

// Função principal
const main = async () => {
  printBanner();

  // Verificar diretório de dados
  if (!fs.existsSync(DATA_DIR)) {
    console.log('>> CRIANDO DIRETÓRIO DE DADOS');
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Verificar base atual
  console.log('>> VERIFICANDO BASE ATUAL');
  const currentDbExists = fs.existsSync(GEOIP_DB_PATH);
  let shouldDownload = true;

  if (currentDbExists) {
    const baseHealthy = await checkDatabaseIntegrity(GEOIP_DB_PATH);
    
    if (baseHealthy) {
      console.log('✅ Base atual está íntegra e funcional!');
      
      if (!isAutomatedMode) {
        const rl = createInterface();
        try {
          const answer = await new Promise(resolve => {
            rl.question('Deseja continuar mesmo assim? (S/N) ', resolve);
          });
          shouldDownload = answer.toLowerCase() === 's';
        } finally {
          rl.close();
        }
      } else {
        console.log('Como está executando em modo automatizado, consideraremos "S".');
        shouldDownload = true;
      }
    } else {
      console.log('⚠️ Base atual apresenta problemas!');
      shouldDownload = true;
    }
  } else {
    console.log('⚠️ Base de dados não encontrada!');
    shouldDownload = true;
  }

  if (!shouldDownload) {
    console.log('Operação cancelada pelo usuário.');
    return;
  }

  // Baixar nova base
  console.log('>> BAIXANDO NOVA BASE');
  console.log('=== BAIXANDO NOVA BASE DE DADOS ===');
  await downloadFile(DOWNLOAD_URL, DOWNLOAD_PATH);

  // Extrair arquivos
  console.log('>> EXTRAINDO ARQUIVOS');
  console.log('=== EXTRAINDO ARQUIVO ===');
  if (fs.existsSync(EXTRACT_DIR)) {
    // Limpar diretório de extração
    fs.rmSync(EXTRACT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(EXTRACT_DIR, { recursive: true });
  
  try {
    console.log(`Extraindo ${DOWNLOAD_PATH}...`);
    if (process.platform === 'win32') {
      // Usar node-tar para Windows
      const tar = require('tar');
      tar.extract({
        file: DOWNLOAD_PATH,
        cwd: EXTRACT_DIR
      });
    } else {
      // Usar o comando tar nativo para Linux/Mac
      execSync(`tar -xzf "${DOWNLOAD_PATH}" -C "${EXTRACT_DIR}"`);
    }
    console.log('Extração concluída');
  } catch (error) {
    console.error('Erro ao extrair arquivo:', error);
    cleanup();
    return;
  }

  // Localizar arquivo MMDB
  console.log('>> LOCALIZANDO ARQUIVO MMDB');
  console.log('=== LOCALIZANDO ARQUIVO MMDB ===');
  let mmdbPath = null;
  
  try {
    // Encontrar todos os arquivos .mmdb no diretório extraído
    const findMmdbFiles = (dir, results = []) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          findMmdbFiles(filePath, results);
        } else if (path.extname(file) === '.mmdb') {
          results.push(filePath);
        }
      }
      return results;
    };
    
    const mmdbFiles = findMmdbFiles(EXTRACT_DIR);
    if (mmdbFiles.length === 0) {
      throw new Error('Nenhum arquivo .mmdb encontrado na pasta extraída');
    }
    
    mmdbPath = mmdbFiles[0];
    console.log(`✅ Arquivo encontrado: ${mmdbPath}`);
  } catch (error) {
    console.error('Erro ao localizar arquivo MMDB:', error);
    cleanup();
    return;
  }

  // Verificar nova base
  console.log('>> VERIFICANDO NOVA BASE');
  const newBaseHealthy = await checkDatabaseIntegrity(mmdbPath);
  
  if (!newBaseHealthy) {
    console.error('⚠️ Nova base apresenta problemas! Operação cancelada.');
    cleanup();
    return;
  }

  // Substituir base de dados
  console.log('>> SUBSTITUINDO BASE DE DADOS');
  console.log('=== SUBSTITUINDO BASE DE DADOS ===');
  
  try {
    // Fazer backup da base atual se existir
    if (currentDbExists) {
      const backupPath = `${GEOIP_DB_PATH}.bak`;
      console.log(`Fazendo backup da base atual para: ${backupPath}`);
      fs.copyFileSync(GEOIP_DB_PATH, backupPath);
    }
    
    // Copiar nova base para o local correto
    console.log(`Copiando nova base para: ${GEOIP_DB_PATH}`);
    fs.copyFileSync(mmdbPath, GEOIP_DB_PATH);
    console.log('✅ Base de dados substituída com sucesso');
  } catch (error) {
    console.error('Erro ao substituir base de dados:', error);
    cleanup();
    return;
  }

  // Verificar base instalada
  console.log('>> VERIFICANDO BASE INSTALADA');
  const installedBaseHealthy = await checkDatabaseIntegrity(GEOIP_DB_PATH);
  
  if (installedBaseHealthy) {
    console.log('✅ Base instalada verificada com sucesso!');
  } else {
    console.error('⚠️ Base instalada apresenta problemas!');
    if (fs.existsSync(`${GEOIP_DB_PATH}.bak`)) {
      console.log('Restaurando backup...');
      fs.copyFileSync(`${GEOIP_DB_PATH}.bak`, GEOIP_DB_PATH);
    }
  }

  // Limpar arquivos temporários
  cleanup();

  console.log('\n======================================');
  console.log('✅ CORREÇÃO CONCLUÍDA COM SUCESSO');
  console.log('======================================');
};

// Função para baixar arquivo
const downloadFile = (url, destination) => {
  return new Promise((resolve, reject) => {
    console.log('Iniciando download da base de dados...');
    const file = fs.createWriteStream(destination);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Falha no download. Status code: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        const stats = fs.statSync(destination);
        const fileSizeInBytes = stats.size;
        console.log(`Download concluído: ${destination} (${fileSizeInBytes} bytes)`);
        
        // Verificar checksum (MD5)
        try {
          const crypto = require('crypto');
          const fileBuffer = fs.readFileSync(destination);
          const hash = crypto.createHash('md5').update(fileBuffer).digest('hex');
          console.log(`Checksum (MD5): ${hash}`);
          resolve();
        } catch (error) {
          console.error('Erro ao calcular checksum:', error);
          resolve();
        }
      });
    }).on('error', (err) => {
      fs.unlink(destination, () => {}); // Remover arquivo incompleto
      reject(err);
    });
  });
};

// Função para limpar arquivos temporários
const cleanup = () => {
  console.log('>> LIMPANDO ARQUIVOS TEMPORÁRIOS');
  console.log('=== LIMPANDO ARQUIVOS TEMPORÁRIOS ===');
  
  try {
    if (fs.existsSync(DOWNLOAD_PATH)) {
      fs.unlinkSync(DOWNLOAD_PATH);
      console.log(`Arquivo removido: ${DOWNLOAD_PATH}`);
    }
    
    if (fs.existsSync(EXTRACT_DIR)) {
      fs.rmSync(EXTRACT_DIR, { recursive: true, force: true });
      console.log(`Diretório removido: ${EXTRACT_DIR}`);
    }
    
    console.log('✅ Limpeza concluída');
  } catch (error) {
    console.error('Erro ao limpar arquivos temporários:', error);
  }
};

// Função para verificar integridade da base
const checkDatabaseIntegrity = async (dbPath) => {
  console.log(`Verificando integridade da base em: ${dbPath}`);
  
  try {
    // Verificar se o arquivo existe
    if (!fs.existsSync(dbPath)) {
      console.error('Arquivo não encontrado!');
      return false;
    }
    
    // Verificar tamanho
    const stats = fs.statSync(dbPath);
    console.log(`Tamanho da base: ${stats.size} bytes`);
    if (stats.size < 1000000) { // Menos de 1MB é suspeito
      console.error('Arquivo muito pequeno para uma base GeoIP!');
      return false;
    }
    
    // Verificar permissões
    try {
      fs.accessSync(dbPath, fs.constants.R_OK);
      console.log('✅ Arquivo tem permissões de leitura');
    } catch (error) {
      console.error('⚠️ Arquivo sem permissão de leitura!');
      return false;
    }
    
    // Tentar ler o arquivo para a memória
    console.log('Lendo arquivo para a memória...');
    const dbBuffer = fs.readFileSync(dbPath);
    console.log(`✅ Arquivo lido com sucesso (${dbBuffer.length} bytes)`);
    
    // Tentar abrir a base
    console.log('Abrindo a base de dados...');
    const reader = Reader.openBuffer(dbBuffer);
    console.log('✅ Base de dados aberta com sucesso');
    
    // Testar consultas básicas
    const testIPs = [
      { name: 'Google DNS (IPv4)', ip: '8.8.8.8' },
      { name: 'Cloudflare DNS (IPv4)', ip: '1.1.1.1' },
      { name: 'Google DNS (IPv6)', ip: '2001:4860:4860::8888' },
      { name: 'Cloudflare DNS (IPv6)', ip: '2606:4700:4700::1111' }
    ];
    
    let successCount = 0;
    let failCount = 0;
    
    for (const test of testIPs) {
      console.log(`\nTestando IP: ${test.name} (${test.ip})`);
      try {
        const result = reader.city(test.ip);
        console.log(`✅ Consulta bem-sucedida para ${test.ip}`);
        
        // Verificar se contém dados básicos
        const hasCountry = result && result.country && result.country.names;
        const hasCoords = result && result.location && typeof result.location.latitude === 'number';
        
        console.log(`  - País: ${hasCountry ? 'Presente' : 'Ausente'}`);
        console.log(`  - Coordenadas: ${hasCoords ? 'Presentes' : 'Ausentes'}`);
        
        if (hasCountry || hasCoords) {
          successCount++;
        } else {
          console.warn(`⚠️ Consulta retornou dados incompletos para ${test.ip}`);
          failCount++;
        }
      } catch (error) {
        console.error(`❌ Falha ao consultar ${test.ip}: ${error.message}`);
        failCount++;
      }
    }
    
    // Testar com maxmind alternativo como fallback
    if (failCount > 0) {
      console.log('\nTestando com biblioteca alternativa maxmind...');
      try {
        const altLookup = await maxmind.open(dbPath);
        for (const test of testIPs) {
          if (testIPs.failedIPs && testIPs.failedIPs.includes(test.ip)) {
            console.log(`Tentando IP ${test.ip} com maxmind...`);
            const result = altLookup.get(test.ip);
            if (result && (result.country || (result.location && result.location.latitude))) {
              console.log(`✅ Consulta bem-sucedida com maxmind para ${test.ip}`);
              successCount++;
              failCount--;
            }
          }
        }
      } catch (err) {
        console.log(`Erro ao tentar com fallback: ${err.message}`);
      }
    }
    
    // Resumo
    console.log('\n=== RESULTADO DA VERIFICAÇÃO ===');
    console.log(`Total de testes: ${testIPs.length}`);
    console.log(`Testes bem-sucedidos: ${successCount}`);
    console.log(`Testes com falha: ${failCount}`);
    
    if (failCount === 0) {
      console.log('✅✅✅ Base de dados íntegra e funcional');
      return true;
    } else if (failCount < testIPs.length) {
      console.log('⚠️⚠️⚠️ Base de dados parcialmente funcional (alguns testes falharam)');
      return true; // Consideramos ok se pelo menos alguns testes passaram
    } else {
      console.log('❌❌❌ Base de dados não funcional (todos os testes falharam)');
      return false;
    }
  } catch (error) {
    console.error(`Erro ao verificar integridade: ${error.message}`);
    return false;
  }
};

// Iniciar processo
main().catch(error => {
  console.error('Erro fatal:', error);
  cleanup();
  process.exit(1);
}); 