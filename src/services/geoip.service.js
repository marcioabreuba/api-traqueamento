const fs = require('fs');
const path = require('path');
const maxmind = require('maxmind');
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
    geoIpReader = await maxmind.open(dbPath);
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
const lookupIp = (ip) => {
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

    // Consultar IP
    const geoData = geoIpReader.get(ip);
    if (!geoData) {
      logger.debug(`Não foram encontradas informações para o IP: ${ip}`);
      return null;
    }

    // Processar e retornar dados
    return {
      ip,
      country: geoData.country?.iso_code,
      countryName: geoData.country?.names?.pt || geoData.country?.names?.en,
      region: geoData.subdivisions?.[0]?.iso_code,
      regionName: geoData.subdivisions?.[0]?.names?.pt || geoData.subdivisions?.[0]?.names?.en,
      city: geoData.city?.names?.pt || geoData.city?.names?.en,
      postalCode: geoData.postal?.code,
      latitude: geoData.location?.latitude,
      longitude: geoData.location?.longitude,
      timezone: geoData.location?.time_zone,
    };
  } catch (error) {
    logger.error(`Erro ao consultar IP ${ip}: ${error.message}`);
    return null;
  }
};

/**
 * Extrair o endereço IP real do cliente a partir dos headers
 * @param {Object} req - Objeto de requisição Express
 * @returns {string} Endereço IP
 */
const extractClientIp = (req) => {
  // Verificar headers que podem conter o IP real (em ordem de confiabilidade)
  const ip =
    req.headers['x-forwarded-for']?.split(',').shift() ||
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    '';

  // Limpar o IP (remover espaços, IPv6 prefix se presente)
  return ip.replace(/^.*:/, '').trim();
};

module.exports = {
  initialize,
  lookupIp,
  extractClientIp,
}; 