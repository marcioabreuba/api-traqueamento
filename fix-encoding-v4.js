const fs = require('fs');
const path = require('path');

// Estratégias de codificação
const encodingStrategies = {
  utf8: (buffer) => buffer.toString('utf8'),
  utf16le: (buffer) => buffer.toString('utf16le'),
  utf16be: (buffer) => buffer.toString('utf16be'),
  win1252: (buffer) => buffer.toString('win1252')
};

// Detecta a codificação do arquivo
function detectEncoding(buffer) {
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { encoding: 'utf8', offset: 3 };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { encoding: 'utf16le', offset: 2 };
  }
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    return { encoding: 'utf16be', offset: 2 };
  }
  return { encoding: 'utf8', offset: 0 };
}

// Processa um arquivo
function processFile(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const { encoding, offset } = detectEncoding(buffer);
    const content = buffer.slice(offset);
    
    // Tenta diferentes codificações até encontrar uma que funcione
    let text;
    for (const [name, strategy] of Object.entries(encodingStrategies)) {
      try {
        text = strategy(content);
        break;
      } catch {
        continue;
      }
    }
    
    if (!text) {
      throw new Error('Não foi possível decodificar o arquivo');
    }
    
    // Normaliza quebras de linha
    text = text.replace(/\r\n/g, '\n');
    
    // Salva o arquivo
    fs.writeFileSync(filePath, text, { encoding: 'utf8' });
    
    return true;
  } catch (error) {
    return false;
  }
}

// Lista de arquivos para processar
const files = ['checkout-tracking.js', 'pageview-only.js', 'simple-pixel.js'];

// Processa cada arquivo
const results = files.map(file => {
  const filePath = path.join(__dirname, file);
  const success = processFile(filePath);
  return { file, success };
});

// Verifica resultados
const failedFiles = results.filter(r => !r.success).map(r => r.file);
if (failedFiles.length > 0) {
  process.exit(1);
} 