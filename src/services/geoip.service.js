const fs = require('fs');
const path = require('path');
const { Reader } = require('@maxmind/geoip2-node');
const logger = require('../config/logger');
const config = require('../config/config');

// Armazenar a instância do reader do MaxMind
let geoIpReader = null;

/**
 * Inicializar o leitor de base GeoIP
 */
const initialize = async () => {
  try {
    logger.info('Iniciando inicialização do serviço GeoIP');
    const dbPath = path.resolve(config.geoip.dbPath);
    
    // Verificar se o arquivo existe
    if (!fs.existsSync(dbPath)) {
      logger.error(`Base de dados GeoIP não encontrada em: ${dbPath}`);
      return false;
    }
    
    logger.info(`Base de dados GeoIP encontrada em: ${dbPath}`);
    
    // Inicializar o leitor GeoIP
    geoIpReader = await Reader.open(dbPath);
    logger.info('Base de dados GeoIP inicializada com sucesso');
    return true;
  } catch (error) {
    logger.error(`Erro ao inicializar base GeoIP: ${error.message}`);
    logger.error(`Stack trace: ${error.stack}`);
    return false;
  }
};

/**
 * Obter informações de localização a partir de um endereço IP
 * @param {string} ip - Endereço IP
 * @returns {Object|null} Dados de localização ou null se não encontrado
 */
const lookupIp = async (ip) => {
  try {
    logger.debug(`Iniciando lookup para IP: ${ip}`);
    
    // Verificar se o leitor foi inicializado
    if (!geoIpReader) {
      logger.error('Base de dados GeoIP não inicializada');
      return null;
    }

    // Validar IP
    if (!ip || ip === '127.0.0.1' || ip === 'localhost') {
      logger.warn(`IP inválido ou local: ${ip}`);
      return null;
    }

    // Buscar informações do IP
    logger.debug('Consultando base de dados MaxMind');
    const result = await geoIpReader.city(ip);
    
    if (!result) {
      logger.warn(`Nenhuma informação encontrada para o IP: ${ip}`);
      return null;
    }

    logger.debug('Dados encontrados na base MaxMind');

    const geoData = {
      country: result.country?.names?.pt || result.country?.names?.en || 'Desconhecido',
      city: result.city?.names?.pt || result.city?.names?.en || 'Desconhecido',
      state: result.subdivisions?.[0]?.names?.pt || result.subdivisions?.[0]?.names?.en || 'Desconhecido',
      latitude: result.location?.latitude || null,
      longitude: result.location?.longitude || null,
      timezone: result.location?.timeZone || null,
      continent: result.continent?.names?.pt || result.continent?.names?.en || 'Desconhecido',
      postalCode: result.postal?.code || null,
      accuracy: result.location?.accuracyRadius || null,
    };

    logger.info(`Dados geográficos obtidos para IP ${ip}:`);
    logger.info(`- País: ${geoData.country}`);
    logger.info(`- Cidade: ${geoData.city}`);
    logger.info(`- Estado: ${geoData.state}`);
    logger.info(`- Continente: ${geoData.continent}`);
    if (geoData.latitude && geoData.longitude) {
      logger.info(`- Coordenadas: ${geoData.latitude}, ${geoData.longitude}`);
    }
    if (geoData.timezone) {
      logger.info(`- Timezone: ${geoData.timezone}`);
    }
    if (geoData.accuracy) {
      logger.info(`- Precisão: ${geoData.accuracy}km`);
    }

    return geoData;
  } catch (error) {
    logger.error(`Erro ao buscar informações do IP ${ip}: ${error.message}`);
    logger.error(`Stack trace: ${error.stack}`);
    return null;
  }
};

/**
 * Extrair o IP do cliente da requisição
 * @param {Object} req - Objeto de requisição Express
 * @returns {string} IP do cliente
 */
const extractClientIp = (req) => {
  logger.debug('Iniciando extração do IP do cliente');
  
  // Tentar obter o IP real do cliente
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ip = forwardedFor.split(',')[0].trim();
    logger.info(`IP extraído do header X-Forwarded-For: ${ip}`);
    return ip;
  }
  
  // Tentar obter o IP do socket
  if (req.socket && req.socket.remoteAddress) {
    logger.info(`IP extraído do socket: ${req.socket.remoteAddress}`);
    return req.socket.remoteAddress;
  }
  
  // Fallback para IP desconhecido
  logger.warn('Não foi possível extrair o IP do cliente');
  return 'unknown';
};

module.exports = {
  initialize,
  lookupIp,
  extractClientIp,
}; 