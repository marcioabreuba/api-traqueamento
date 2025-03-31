const geoipService = require('./src/services/geoip.service');

async function testGeoIP() {
  console.log('Testando serviço de GeoIP...');
  
  // Inicializar o serviço explicitamente
  console.log('Inicializando serviço GeoIP...');
  await geoipService.initialize();
  
  const testIPs = [
    '72.14.201.238', // SEU IP
    '8.8.8.8',        // Google DNS (EUA)
    '1.1.1.1',        // Cloudflare DNS (Austrália)
    '200.160.2.3',    // Brasil
    '95.216.244.183', // Finlândia
    '127.0.0.1',      // Localhost
    'invalid-ip'      // IP inválido
  ];
  
  for (const ip of testIPs) {
    const isSeuIP = ip === '72.14.201.238';
    console.log(`\nConsultando IP: ${ip}${isSeuIP ? ' (SEU IP)' : ''}`);
    try {
      const result = await geoipService.getLocation(ip);
      console.log('Resultado:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(`Erro ao consultar IP ${ip}:`, error.message);
      if (error.code) {
        console.error(`Código de erro: ${error.code}`);
      }
    }
  }
}

testGeoIP().catch(err => {
  console.error('Erro não tratado:', err);
  process.exit(1);
});
