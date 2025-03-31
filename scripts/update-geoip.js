/**
 * Script para baixar e atualizar a base de dados GeoIP do MaxMind
 * 
 * Uso: 
 * - node scripts/update-geoip.js
 * 
 * Requer:
 * - MAXMIND_ACCOUNT_ID e MAXMIND_LICENSE_KEY configurados no .env
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');
const extract = require('extract-zip');
const tar = require('tar');
const dotenv = require('dotenv');
const logger = require('../src/config/logger');
const { Reader } = require('@maxmind/geoip2-node');

// Carregar variáveis de ambiente
dotenv.config({ path: path.join(__dirname, '../.env') });

const MAXMIND_ACCOUNT_ID = process.env.MAXMIND_ACCOUNT_ID;
const MAXMIND_LICENSE_KEY = process.env.MAXMIND_LICENSE_KEY;
const TARGET_DIR = path.join(__dirname, '../data');
const DATABASE_FILENAME = 'GeoLite2-City.mmdb';
const TARGET_PATH = path.join(TARGET_DIR, DATABASE_FILENAME);

const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const mkdirAsync = promisify(fs.mkdir);

// Verificar credenciais
if (!MAXMIND_ACCOUNT_ID || !MAXMIND_LICENSE_KEY) {
  console.error('Erro: MAXMIND_ACCOUNT_ID e MAXMIND_LICENSE_KEY são necessários no arquivo .env');
  process.exit(1);
}

// Criar diretório de dados se não existir
if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
  console.log(`Diretório criado: ${TARGET_DIR}`);
}

const LICENSE_KEY = MAXMIND_LICENSE_KEY;
const EDITION_ID = 'GeoLite2-City';
const TEMP_TAR_FILE = path.resolve(TARGET_DIR, 'geolite2-city.tar.gz');

async function downloadFile(url, outputPath) {
  console.log('Iniciando download da base de dados GeoIP...');
  console.log(`URL de download: ${url}`);
  
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'arraybuffer',
      maxRedirects: 5
    });
    
    await writeFileAsync(outputPath, Buffer.from(response.data));
    console.log(`Download concluído: ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`Erro no download: ${error.message}`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
    }
    return false;
  }
}

async function extractTarGz(tarFilePath, outputDir) {
  console.log(`Extraindo arquivo ${tarFilePath} para ${outputDir}...`);
  
  try {
    await tar.extract({
      file: tarFilePath,
      cwd: outputDir
    });
    console.log('Extração concluída com sucesso!');
    return true;
  } catch (error) {
    console.error(`Erro na extração: ${error.message}`);
    return false;
  }
}

async function findMmdbFile(directory) {
  console.log(`Buscando arquivo .mmdb em ${directory}...`);
  
  try {
    const items = fs.readdirSync(directory, { recursive: true });
    for (const item of items) {
      const itemPath = path.join(directory, item);
      if (fs.statSync(itemPath).isDirectory()) {
        const result = await findMmdbFile(itemPath);
        if (result) return result;
      } else if (item.endsWith('.mmdb')) {
        console.log(`Arquivo .mmdb encontrado: ${itemPath}`);
        return itemPath;
      }
    }
  } catch (error) {
    console.error(`Erro ao buscar arquivo .mmdb: ${error.message}`);
  }
  
  return null;
}

async function testDatabase(dbPath) {
  console.log(`Testando banco de dados em ${dbPath}...`);
  
  try {
    const buffer = fs.readFileSync(dbPath);
    const reader = Reader.openBuffer(buffer);
    
    // Teste com um IP conhecido (Google DNS)
    const testIp = '8.8.8.8';
    const result = reader.city(testIp);
    
    console.log(`Teste bem-sucedido com IP ${testIp}:`);
    console.log(`- País: ${result.country && result.country.names && (result.country.names.pt || result.country.names.en) || 'Desconhecido'}`);
    console.log(`- Cidade: ${result.city && result.city.names && (result.city.names.pt || result.city.names.en) || 'Desconhecido'}`);
    
    return true;
  } catch (error) {
    console.error(`Erro ao testar banco de dados: ${error.message}`);
    return false;
  }
}

async function main() {
  // Criar diretório de destino, se não existir
  try {
    if (!fs.existsSync(TARGET_DIR)) {
      await mkdirAsync(TARGET_DIR, { recursive: true });
      console.log(`Diretório criado: ${TARGET_DIR}`);
    }
  } catch (error) {
    console.error(`Erro ao criar diretório: ${error.message}`);
    return;
  }
  
  // Montar URL de download
  const downloadUrl = `https://download.maxmind.com/app/geoip_download?edition_id=${EDITION_ID}&license_key=${LICENSE_KEY}&suffix=tar.gz`;
  
  // Efetuar download
  const downloadSuccess = await downloadFile(downloadUrl, TEMP_TAR_FILE);
  if (!downloadSuccess) {
    console.error('Falha no download. Abortando atualização.');
    return;
  }
  
  // Extrair arquivo
  const extractSuccess = await extractTarGz(TEMP_TAR_FILE, TARGET_DIR);
  if (!extractSuccess) {
    console.error('Falha na extração. Abortando atualização.');
    // Limpar arquivo de download
    try {
      await unlinkAsync(TEMP_TAR_FILE);
      console.log(`Arquivo temporário removido: ${TEMP_TAR_FILE}`);
    } catch (error) {
      console.error(`Erro ao remover arquivo temporário: ${error.message}`);
    }
    return;
  }
  
  // Encontrar arquivo .mmdb extraído
  const mmdbFile = await findMmdbFile(TARGET_DIR);
  if (!mmdbFile) {
    console.error('Arquivo .mmdb não encontrado após extração. Abortando atualização.');
    return;
  }
  
  // Mover arquivo para o destino final
  try {
    fs.copyFileSync(mmdbFile, TARGET_PATH);
    console.log(`Base de dados atualizada com sucesso: ${TARGET_PATH}`);
    
    // Testar a base de dados atualizada
    const testSuccess = await testDatabase(TARGET_PATH);
    if (testSuccess) {
      console.log('A base de dados foi atualizada e validada com sucesso!');
    } else {
      console.warn('AVISO: A base de dados foi atualizada, mas o teste falhou. Verifique a integridade do arquivo.');
    }
  } catch (error) {
    console.error(`Erro ao copiar arquivo para destino final: ${error.message}`);
  }
  
  // Limpar arquivos temporários
  try {
    await unlinkAsync(TEMP_TAR_FILE);
    console.log(`Arquivo temporário removido: ${TEMP_TAR_FILE}`);
    
    // Remover outros arquivos extraídos
    const extractedDir = path.join(TARGET_DIR, 'GeoLite2-City_*');
    execSync(`rm -rf ${extractedDir}`);
    console.log('Arquivos temporários removidos com sucesso!');
  } catch (error) {
    console.error(`Erro ao limpar arquivos temporários: ${error.message}`);
  }
}

main().catch(error => {
  console.error(`Erro não tratado: ${error.message}`);
  process.exit(1);
}); 