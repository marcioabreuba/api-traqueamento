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
const https = require('https');
const zlib = require('zlib');
const tar = require('tar');
const dotenv = require('dotenv');
const logger = require('../src/config/logger');

// Carregar variáveis de ambiente
dotenv.config({ path: path.join(__dirname, '../.env') });

const MAXMIND_ACCOUNT_ID = process.env.MAXMIND_ACCOUNT_ID;
const MAXMIND_LICENSE_KEY = process.env.MAXMIND_LICENSE_KEY;
const TARGET_DIR = path.join(__dirname, '../data');
const DATABASE_FILENAME = 'GeoLite2-City.mmdb';
const TARGET_PATH = path.join(TARGET_DIR, DATABASE_FILENAME);

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

// URL para download
const downloadUrl = `https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${MAXMIND_LICENSE_KEY}&suffix=tar.gz`;

console.log('Iniciando download da base de dados GeoIP...');

// Fazer o download do arquivo
const downloadFile = () => {
  return new Promise((resolve, reject) => {
    const tempFile = path.join(TARGET_DIR, 'temp-geoip.tar.gz');
    const fileStream = fs.createWriteStream(tempFile);

    https.get(downloadUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Falha no download, status: ${response.statusCode}`));
        return;
      }

      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`Download concluído: ${tempFile}`);
        resolve(tempFile);
      });
    }).on('error', (err) => {
      fs.unlink(tempFile, () => {});
      reject(err);
    });
  });
};

// Extrair o arquivo baixado
const extractFile = (filePath) => {
  return new Promise((resolve, reject) => {
    console.log('Extraindo arquivo...');
    
    fs.createReadStream(filePath)
      .pipe(zlib.createGunzip())
      .pipe(tar.extract({
        cwd: TARGET_DIR,
        strict: true
      }))
      .on('error', reject)
      .on('end', () => {
        console.log('Extração concluída');
        resolve();
      });
  });
};

// Mover o arquivo para o local correto
const moveFile = () => {
  return new Promise((resolve, reject) => {
    // Encontrar o diretório extraído
    const files = fs.readdirSync(TARGET_DIR);
    const extractedDir = files.find(file => file.startsWith('GeoLite2-City_'));
    
    if (!extractedDir) {
      reject(new Error('Diretório extraído não encontrado'));
      return;
    }
    
    const extractedPath = path.join(TARGET_DIR, extractedDir, DATABASE_FILENAME);
    
    if (!fs.existsSync(extractedPath)) {
      reject(new Error(`Arquivo ${DATABASE_FILENAME} não encontrado no diretório extraído`));
      return;
    }
    
    // Se o arquivo de destino já existir, fazer backup
    if (fs.existsSync(TARGET_PATH)) {
      const backupPath = `${TARGET_PATH}.bak`;
      fs.renameSync(TARGET_PATH, backupPath);
      console.log(`Backup do arquivo anterior criado: ${backupPath}`);
    }
    
    // Mover o arquivo
    fs.copyFileSync(extractedPath, TARGET_PATH);
    console.log(`Arquivo movido para ${TARGET_PATH}`);
    
    // Limpar arquivos temporários
    fs.rmSync(path.join(TARGET_DIR, extractedDir), { recursive: true, force: true });
    resolve();
  });
};

// Executar o processo completo
const run = async () => {
  try {
    const tempFile = await downloadFile();
    await extractFile(tempFile);
    await moveFile();
    
    // Remover o arquivo temporário
    fs.unlinkSync(tempFile);
    console.log('Arquivo temporário removido');
    
    console.log(`Base de dados GeoIP atualizada com sucesso: ${TARGET_PATH}`);
  } catch (error) {
    console.error('Erro ao atualizar base de dados GeoIP:', error);
    process.exit(1);
  }
};

run(); 