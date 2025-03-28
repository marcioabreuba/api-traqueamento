const fs = require('fs');
const path = require('path');
const maxmind = require('maxmind');

async function testGeoIP() {
  try {
    console.log('Iniciando teste da base de dados GeoIP...');
    
    // Tentar diferentes caminhos possíveis
    const possiblePaths = [
      path.join(process.cwd(), 'data', 'GeoLite2-City.mmdb'),
      path.join(__dirname, 'data', 'GeoLite2-City.mmdb'),
      'data/GeoLite2-City.mmdb',
      './data/GeoLite2-City.mmdb'
    ];

    let dbPath = null;
    
    // Encontrar o primeiro caminho válido
    for (const testPath of possiblePaths) {
      console.log(`Tentando caminho: ${testPath}`);
      if (fs.existsSync(testPath)) {
        dbPath = testPath;
        console.log(`Arquivo encontrado em: ${dbPath}`);
        break;
      }
    }

    if (!dbPath) {
      console.error('Nenhum caminho válido encontrado para a base de dados GeoIP');
      process.exit(1);
    }

    // Verificar permissões
    try {
      fs.accessSync(dbPath, fs.constants.R_OK);
      console.log('Arquivo tem permissões de leitura');
    } catch (error) {
      console.error('Erro ao verificar permissões:', error);
      process.exit(1);
    }

    // Verificar tamanho
    const stats = fs.statSync(dbPath);
    console.log(`Tamanho do arquivo: ${stats.size} bytes`);

    // Tentar abrir a base de dados
    console.log('Tentando abrir a base de dados...');
    const reader = await maxmind.open(dbPath);
    console.log('Base de dados aberta com sucesso');

    // Testar com um IP
    console.log('Testando com IP 8.8.8.8...');
    const result = reader.get('8.8.8.8');
    console.log('Resultado:', result);

    process.exit(0);
  } catch (error) {
    console.error('Erro durante o teste:', error);
    process.exit(1);
  }
}

testGeoIP(); 