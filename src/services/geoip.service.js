const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');
const config = require('../config/config');
const maxmind = require('maxmind');
const ApiError = require('../utils/ApiError');
const httpStatus = require('http-status');

// Armazenar a instância do reader do MaxMind
let reader = null;

/**
 * Inicializar o leitor de base GeoIP
 */
const initialize = async () => {
  try {
    logger.info('Iniciando inicialização do serviço GeoIP');
    
    // Tentar diferentes caminhos possíveis
    const possiblePaths = [
      path.join(process.cwd(), 'data', 'GeoLite2-City.mmdb'),
      path.join(__dirname, '../../data/GeoLite2-City.mmdb'),
      'data/GeoLite2-City.mmdb',
      './data/GeoLite2-City.mmdb'
    ];

    let dbPath = null;
    
    // Encontrar o primeiro caminho válido
    for (const testPath of possiblePaths) {
      logger.info(`Tentando caminho: ${testPath}`);
      if (fs.existsSync(testPath)) {
        dbPath = testPath;
        logger.info(`Arquivo encontrado em: ${dbPath}`);
        break;
      }
    }

    if (!dbPath) {
      logger.error('Nenhum caminho válido encontrado para a base de dados GeoIP');
      return false;
    }

    // Verificar permissões
    try {
      fs.accessSync(dbPath, fs.constants.R_OK);
      logger.info('Arquivo tem permissões de leitura');
    } catch (error) {
      logger.error(`Erro ao verificar permissões: ${error.message}`);
      return false;
    }

    // Verificar tamanho
    const stats = fs.statSync(dbPath);
    logger.info(`Tamanho do arquivo: ${stats.size} bytes`);
    
    // Tentar inicializar o leitor
    try {
      logger.info('Tentando abrir a base de dados GeoIP...');
      reader = await maxmind.open(dbPath);
      logger.info('Base de dados GeoIP aberta com sucesso');
    } catch (error) {
      logger.error(`Erro ao abrir a base de dados GeoIP: ${error.message}`);
      return false;
    }
    
    // Verificar se o reader foi inicializado corretamente
    if (!reader) {
      logger.error('Falha ao inicializar o leitor MaxMind');
      return false;
    }
    
    // Testar o leitor com um IP de exemplo
    try {
      logger.info('Testando o leitor com IP 8.8.8.8...');
      const testResult = reader.get('8.8.8.8');
      if (!testResult) {
        logger.error('Falha ao testar o leitor MaxMind: resultado nulo');
        return false;
      }
      logger.info('Base de dados GeoIP inicializada e testada com sucesso');
      return true;
    } catch (testError) {
      logger.error('Falha ao testar o leitor MaxMind:', testError);
      return false;
    }
  } catch (error) {
    logger.error('Erro ao inicializar GeoIP:', error);
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
    if (!reader) {
      logger.warn('Serviço GeoIP não inicializado');
      return null;
    }

    // Remover prefixo IPv6 se presente
    const cleanIp = ip.replace(/^::ffff:/, '');
    
    try {
      const result = reader.get(cleanIp);
      if (!result) {
        logger.warn(`Nenhum dado GeoIP encontrado para o IP: ${cleanIp}`);
        return null;
      }
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