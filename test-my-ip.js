const fs = require('fs');
const path = require('path');
const { Reader } = require('@maxmind/geoip2-node');

async function testSpecificIP() {
  console.log('Testando especificamente o seu IP na base GeoLite2-City...');
  
  // Definir o IP a ser testado
  const yourIP = '2804:1054:3016:61b0:8070:e8a8:6f99:3663';
  
  // Encontrar o arquivo de banco de dados
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
    console.error('Banco de dados GeoIP não encontrado!');
    return;
  }
  
  try {
    console.log(`Carregando banco de dados de ${dbPath}...`);
    const dbBuffer = fs.readFileSync(dbPath);
    const reader = Reader.openBuffer(dbBuffer);
    
    console.log(`Consultando IP: ${yourIP}`);
    const result = reader.city(yourIP);
    
    console.log('\n=== RESPOSTA COMPLETA ===');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('\n=== DADOS EXTRAÍDOS ===');
    console.log('País:', result.country && result.country.names ? 
      (result.country.names['pt-BR'] || result.country.names.pt || result.country.names.en) : 'N/A');
    
    console.log('Cidade:', result.city && result.city.names ? 
      (result.city.names['pt-BR'] || result.city.names.pt || result.city.names.en) : 'N/A');
    
    console.log('Estado:', result.subdivisions && result.subdivisions[0] && result.subdivisions[0].names ? 
      (result.subdivisions[0].names['pt-BR'] || result.subdivisions[0].names.pt || result.subdivisions[0].names.en) : 'N/A');
    
    console.log('Código Postal:', result.postal && result.postal.code ? result.postal.code : 'N/A');
    
    console.log('Latitude:', result.location && result.location.latitude ? result.location.latitude : 'N/A');
    console.log('Longitude:', result.location && result.location.longitude ? result.location.longitude : 'N/A');
    
    console.log('Fuso Horário:', result.location && result.location.timeZone ? result.location.timeZone : 'N/A');
    console.log('Raio de Precisão:', result.location && result.location.accuracyRadius ? `${result.location.accuracyRadius} km` : 'N/A');
    
    // Informações adicionais úteis
    console.log('\n=== INFORMAÇÕES ADICIONAIS ===');
    console.log('Continente:', result.continent && result.continent.names ? 
      (result.continent.names['pt-BR'] || result.continent.names.pt || result.continent.names.en) : 'N/A');
    
    console.log('País Registrado:', result.registeredCountry && result.registeredCountry.names ? 
      (result.registeredCountry.names['pt-BR'] || result.registeredCountry.names.pt || result.registeredCountry.names.en) : 'N/A');
    
    console.log('Rede IP:', result.traits && result.traits.network ? result.traits.network : 'N/A');
    
  } catch (error) {
    console.error('Erro ao consultar o banco de dados:', error.message);
  }
}

testSpecificIP().catch(error => {
  console.error('Erro não tratado:', error);
}); 