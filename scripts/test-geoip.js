const fs = require('fs');
const path = require('path');
const { Reader } = require('@maxmind/geoip2-node');

/**
 * Teste específico dos IPs solicitados
 */
async function testSpecificIPs() {
  console.log('=== TESTE ESPECÍFICO DE IPs NA BASE GEOIP ===');
  
  // Tentar diferentes caminhos para o arquivo do banco
  const possiblePaths = [
    path.join(process.cwd(), 'data', 'GeoLite2-City.mmdb'),
    path.join(__dirname, '../data/GeoLite2-City.mmdb'),
    '/opt/render/project/src/data/GeoLite2-City.mmdb'
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

  console.log(`\nTamanho do arquivo: ${fs.statSync(dbPath).size} bytes`);
  
  // Ler o banco de dados
  try {
    console.log('Lendo o banco de dados...');
    const dbBuffer = fs.readFileSync(dbPath);
    const reader = Reader.openBuffer(dbBuffer);
    console.log('Banco de dados aberto com sucesso!');
    
    // Lista de IPs para testar
    const testIPs = [
      { value: '186.193.57.153', description: 'IPv4 específico' },
      { value: '2804:1054:3016:61b0:8070:e8a8:6f99:3663', description: 'IPv6 específico' },
      { value: '::ffff:186.193.57.153', description: 'IPv4 convertido para formato IPv6' },
      { value: '8.8.8.8', description: 'IPv4 Google DNS (referência)' },
      { value: '2001:4860:4860::8888', description: 'IPv6 Google DNS (referência)' }
    ];
    
    for (const ip of testIPs) {
      console.log('\n============================================');
      console.log(`CONSULTANDO: ${ip.description} (${ip.value})`);
      console.log('============================================');
      
      try {
        // Obter resposta bruta
        const result = reader.city(ip.value);
        
        // Extrair e mostrar dados relevantes
        console.log('DADOS OBTIDOS:');
        const country = (result.country && result.country.names && 
                      (result.country.names.pt || result.country.names['pt-BR'] || result.country.names.en)) || 'NÃO DISPONÍVEL';
        
        const city = (result.city && result.city.names && 
                    (result.city.names.pt || result.city.names['pt-BR'] || result.city.names.en)) || 'NÃO DISPONÍVEL';
                    
        const subdivision = (result.subdivisions && result.subdivisions[0] && result.subdivisions[0].names && 
                          (result.subdivisions[0].names.pt || result.subdivisions[0].names['pt-BR'] || result.subdivisions[0].names.en)) || 'NÃO DISPONÍVEL';
                          
        const postal = (result.postal && result.postal.code) || 'NÃO DISPONÍVEL';
        const latitude = (result.location && result.location.latitude) || 'NÃO DISPONÍVEL';
        const longitude = (result.location && result.location.longitude) || 'NÃO DISPONÍVEL';
        const timezone = (result.location && result.location.timeZone) || 'NÃO DISPONÍVEL';
        
        console.log(`País: ${country}`);
        console.log(`Estado: ${subdivision}`);
        console.log(`Cidade: ${city}`);
        console.log(`CEP: ${postal}`);
        console.log(`Coordenadas: ${latitude}, ${longitude}`);
        console.log(`Fuso: ${timezone}`);
        
        console.log('\n[Resposta completa]');
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        console.error(`ERRO: ${error.message}`);
        console.error(`Tipo do erro: ${error.constructor.name}`);
        
        if (error.message.includes('Unknown type NaN at offset')) {
          console.log('NOTA: Este erro indica problema na estrutura interna da base de dados');
          console.log('Possivelmente um registro corrompido ou incompatível com a versão da biblioteca');
        } else if (error.message.includes('Address not found')) {
          console.log('NOTA: O endereço IP não foi encontrado na base de dados');
        }
      }
    }
  } catch (error) {
    console.error(`Erro ao abrir a base de dados: ${error.message}`);
  }
}

testSpecificIPs().catch(console.error); 