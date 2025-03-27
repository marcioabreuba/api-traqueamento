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
    const dbPath = path.resolve(config.geoip.dbPath);
    
    // Verificar se o arquivo existe
    if (!fs.existsSync(dbPath)) {
      logger.warn(`Base de dados GeoIP não encontrada em: ${dbPath}`);
      return false;
    }
    
    // Inicializar o leitor GeoIP
    geoIpReader = await Reader.open(dbPath);
    logger.info('Base de dados GeoIP inicializada com sucesso');
    return true;
  } catch (error) {
    logger.error(`Erro ao inicializar base GeoIP: ${error.message}`);
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
    // Verificar se o leitor foi inicializado
    if (!geoIpReader) {
      logger.warn('Base de dados GeoIP não inicializada');
      return null;
    }

    // Validar IP
    if (!ip || ip === '127.0.0.1' || ip === 'localhost') {
      logger.debug(`IP inválido ou local: ${ip}`);
      return null;
    }

    // Buscar informações do IP
    const result = await geoIpReader.city(ip);
    
    if (!result) {
      logger.debug(`Nenhuma informação encontrada para o IP: ${ip}`);
      return null;
    }

    return {
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
  } catch (error) {
    logger.error(`Erro ao buscar informações do IP ${ip}: ${error.message}`);
    return null;
  }
};

/**
 * Extrair o IP do cliente da requisição
 * @param {Object} req - Objeto de requisição Express
 * @returns {string} IP do cliente
 */
const extractClientIp = (req) => {
  // Tentar obter o IP real do cliente
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // Pegar o primeiro IP da lista (cliente original)
    return forwardedFor.split(',')[0].trim();
  }
  
  // Tentar obter o IP do socket
  if (req.socket && req.socket.remoteAddress) {
    return req.socket.remoteAddress;
  }
  
  // Fallback para IP desconhecido
  return 'unknown';
};

module.exports = {
  initialize,
  lookupIp,
  extractClientIp,
}; 