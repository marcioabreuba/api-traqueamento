const fs = require('fs');
const path = require('path');
const { Reader } = require('@maxmind/geoip2-node');

async function testRawGeoIP() {
  console.log('Testando dados brutos do GeoIP...');
  
  // Tentar diferentes caminhos para o arquivo do banco
  const possiblePaths = [
    path.join(process.cwd(), 'data', 'GeoLite2-City.mmdb'),
    path.join(__dirname, 'data', 'GeoLite2-City.mmdb'),
    './data/GeoLite2-City.mmdb'
  ];
  
  let dbPath = null;
  for (const testPath of possiblePaths) {
    console.log(`Verificando caminho: ${testPath}`);
    if (fs.existsSync(testPath)) {
      dbPath = testPath;
      console.log(`Arquivo encontrado em: ${dbPath}`);
      break;
    }
  }
  
  if (!dbPath) {
    console.error('Banco de dados GeoIP não encontrado');
    return;
  }
  
  // Ler o banco de dados
  const dbBuffer = fs.readFileSync(dbPath);
  const reader = Reader.openBuffer(dbBuffer);
  
  // Lista de IPs para testar
  const testIPs = [
    '2804:1054:3016:61b0:8070:e8a8:6f99:3663', // Seu IP
    '8.8.8.8',                // Google DNS (EUA)
    '1.1.1.1',                // Cloudflare (Austrália) 
    '200.160.2.3',            // Brasil
    '95.216.244.183'         // Finlândia (sabemos que tem dados completos)
  ];
  
  for (const ip of testIPs) {
    console.log(`\n=== CONSULTANDO IP: ${ip} ===`);
    try {
      // Obter resposta bruta
      const result = reader.city(ip);
      
      // Mostrar resposta completa
      console.log('RESPOSTA COMPLETA:');
      console.log(JSON.stringify(result, null, 2));
      
      // Verificar campos específicos
      console.log('\nVERIFICAÇÃO DE CAMPOS:');
      console.log(`País: ${(result.country && result.country.names && 
                 (result.country.names.pt || result.country.names['pt-BR'] || result.country.names.en)) || 'NÃO DISPONÍVEL'}`);
                 
      console.log(`Cidade: ${(result.city && result.city.names && 
                 (result.city.names.pt || result.city.names['pt-BR'] || result.city.names.en)) || 'NÃO DISPONÍVEL'}`);
                 
      console.log(`Subdivisão: ${(result.subdivisions && result.subdivisions[0] && result.subdivisions[0].names && 
                 (result.subdivisions[0].names.pt || result.subdivisions[0].names['pt-BR'] || result.subdivisions[0].names.en)) || 'NÃO DISPONÍVEL'}`);
                 
      console.log(`CEP: ${(result.postal && result.postal.code) || 'NÃO DISPONÍVEL'}`);
      console.log(`Latitude: ${(result.location && result.location.latitude) || 'NÃO DISPONÍVEL'}`);
      console.log(`Longitude: ${(result.location && result.location.longitude) || 'NÃO DISPONÍVEL'}`);
      console.log(`Fuso horário: ${(result.location && result.location.timeZone) || 'NÃO DISPONÍVEL'}`);
      console.log(`Raio de precisão: ${(result.location && result.location.accuracyRadius) || 'NÃO DISPONÍVEL'}`);
    } catch (error) {
      console.error(`Erro ao consultar IP ${ip}: ${error.message}`);
    }
  }
}

testRawGeoIP().catch(console.error); 