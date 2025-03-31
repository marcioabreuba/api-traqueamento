const fs = require('fs');
const path = require('path');

const files = ['checkout-tracking.js', 'pageview-only.js', 'simple-pixel.js'];

files.forEach((file) => {
  try {
    // Ler o arquivo como buffer
    const buffer = fs.readFileSync(file);

    // Remover BOM se presente
    let content = buffer;
    if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      content = buffer.slice(3);
    }

    // Converter para string UTF-8
    const text = content.toString('utf8');

    // Salvar o arquivo com codificação UTF-8 sem BOM
    fs.writeFileSync(file, text, 'utf8');

    console.log(`Arquivo ${file} corrigido com sucesso`);
  } catch (error) {
    console.error(`Erro ao corrigir arquivo ${file}:`, error);
  }
});
