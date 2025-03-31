const fs = require('fs');
const path = require('path');
const { Reader } = require('@maxmind/geoip2-node');

/**
 * Verifica a integridade da base de dados GeoIP
 */
async function verificarIntegridadeBase() {
  console.log('=== VERIFICAÇÃO DE INTEGRIDADE DA BASE GEOIP ===');
  
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
    console.error('❌ Base de dados GeoIP não encontrada');
    return false;
  }

  // Verificar tamanho do arquivo
  const stats = fs.statSync(dbPath);
  const fileSize = stats.size;
  console.log(`Tamanho da base: ${fileSize} bytes`);
  
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
        
        console.log(`  - País: ${hasCountry ? 'Presente' : 'Ausente'}`);
        console.log(`  - Coordenadas: ${hasLocation ? 'Presentes' : 'Ausentes'}`);
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
  
  if (testsFailed === 0) {
    console.log('✅✅✅ Base de dados íntegra e funcional');
    return true;
  } else if (testsPassed > 0) {
    console.log('⚠️⚠️⚠️ Base de dados parcialmente funcional (alguns testes falharam)');
    return null;
  } else {
    console.log('❌❌❌ Base de dados corrompida ou incompatível');
    return false;
  }
}

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

// Executar o diagnóstico e depois os testes específicos
async function executarTestes() {
  console.log('Iniciando verificação de integridade da base...\n');
  await verificarIntegridadeBase();
  
  console.log('\n\nIniciando testes específicos...');
  await testSpecificIPs();
}

executarTestes().catch(console.error); 