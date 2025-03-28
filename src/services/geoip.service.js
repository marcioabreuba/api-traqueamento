const fs = require('fs');
const path = require('path');
const { Reader } = require('@maxmind/geoip2-node');
const logger = require('../config/logger');
const config = require('../config/config');
const maxmind = require('maxmind');
const ApiError = require('../utils/ApiError');
const httpStatus = require('http-status');

// Armazenar a instância do reader do MaxMind
let geoIpReader = null;
let reader = null;

/**
 * Inicializar o leitor de base GeoIP
 */
const initialize = async () => {
  try {
    logger.info('Iniciando inicialização do serviço GeoIP');
    const dbPath = path.join(__dirname, '../../data/GeoLite2-City.mmdb');
    logger.info(`Base de dados GeoIP encontrada em: ${dbPath}`);
    
    reader = await maxmind.open(dbPath);
    logger.info('Base de dados GeoIP inicializada com sucesso');
  } catch (error) {
    logger.error('Erro ao inicializar GeoIP:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Erro ao inicializar serviço GeoIP');
  }
};

/**
 * Obter informações de localização a partir de um endereço IP
 * @param {string} ip - Endereço IP
 * @returns {Object|null} Dados de localização ou null se não encontrado
 */
const lookupIp = async (ip) => {
  try {
    if (!reader) {
      logger.warn('Serviço GeoIP não inicializado');
      return null;
    }

    // Remover prefixo IPv6 se presente
    const cleanIp = ip.replace(/^::ffff:/, '');
    
    try {
      const result = reader.get(cleanIp);
      logger.info(`Dados GeoIP obtidos para IP ${cleanIp}:`, result);
      return result;
    } catch (error) {
      if (error.name === 'AddressNotFoundError') {
        logger.warn(`Nenhum dado GeoIP encontrado para o IP: ${cleanIp}`);
        return null;
      }
      throw error;
    }
  } catch (error) {
    logger.error(`Erro ao buscar informações do IP ${ip}:`, error);
    return null; // Retorna null em caso de erro para não interromper o fluxo
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