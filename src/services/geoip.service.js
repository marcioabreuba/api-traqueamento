const fs = require('fs');
const path = require('path');
const maxmind = require('maxmind');
const logger = require('../config/logger');

// Armazenar a instância do reader do MaxMind
let reader = null;

/**
 * Validar formato do IP
 * @param {string} ip - Endereço IP para validar
 * @returns {boolean} Se o IP é válido
 */
const isValidIp = (ip) => {
  if (!ip || typeof ip !== 'string') return false;
  // Remover prefixo IPv6 se presente
  const cleanIp = ip.replace(/^::ffff:/, '');
  // Regex para validar IPv4
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  // Regex para validar IPv6
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv4Regex.test(cleanIp) || ipv6Regex.test(cleanIp);
};

/**
 * Limpar e validar IP
 * @param {string} ip - IP para limpar e validar
 * @returns {string|null} IP limpo e validado ou null se inválido
 */
const cleanAndValidateIp = (ip) => {
  if (!ip) return null;
  // Remover prefixo IPv6 se presente
  const cleanIp = ip.replace(/^::ffff:/, '');
  if (!isValidIp(cleanIp)) {
    logger.warn(`IP inválido detectado: ${ip}`);
    return null;
  }
  return cleanIp;
};

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
      './data/GeoLite2-City.mmdb',
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
 * Obter localização de um IP
 * @param {string} ip - Endereço IP para geolocalizar
 * @returns {Promise<Object>} Dados de localização
 */
const getLocation = async (ip) => {
  try {
    if (!reader) {
      logger.error('Leitor GeoIP não inicializado');
      return null;
    }

    const cleanIp = cleanAndValidateIp(ip);
    if (!cleanIp) {
      logger.warn(`IP inválido ou não fornecido: ${ip}`);
      return null;
    }
    const result = reader.get(cleanIp);
    if (!result) {
      logger.warn(`Nenhum resultado encontrado para o IP: ${cleanIp}`);
      return null;
    }

    const locationData = {
      country: (result.country && result.country.names && result.country.names.en) || null,
      city: (result.city && result.city.names && result.city.names.en) || null,
      latitude: (result.location && result.location.latitude) || null,
      longitude: (result.location && result.location.longitude) || null,
      timezone: (result.location && result.location.time_zone) || null,
      continent: (result.continent && result.continent.names && result.continent.names.en) || null,
      postal: (result.postal && result.postal.code) || null,
      subdivision:
        (result.subdivisions && result.subdivisions[0] && result.subdivisions[0].names && result.subdivisions[0].names.en) ||
        null,
    };

    logger.info(`Dados de localização obtidos para IP ${cleanIp}:`, locationData);
    return locationData;
  } catch (error) {
    logger.error(`Erro ao obter localização para IP ${ip}:`, error);
    return null;
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

    const cleanIp = cleanAndValidateIp(ip);
    if (!cleanIp) {
      logger.warn(`IP inválido ou não fornecido: ${ip}`);
      return null;
    }
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
    return null;
  }
};

/**
 * Extrair o IP do cliente da requisição
 * @param {Object} req - Objeto de requisição Express
 * @returns {string|null} IP do cliente ou null se não encontrado
 */
const extractClientIp = (req) => {
  logger.debug('Iniciando extração do IP do cliente');
  // Lista de headers para tentar obter o IP
  const ipHeaders = [
    'x-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip',
    'x-client-ip',
    'x-forwarded',
    'forwarded-for',
    'forwarded',
  ];

  // Tentar obter o IP dos headers
  for (const header of ipHeaders) {
    const value = req.headers[header];
    if (value) {
      logger.debug(`Header ${header} encontrado: ${value}`);
      const ip = value.split(',')[0].trim();
      if (isValidIp(ip)) {
        logger.info(`IP válido extraído do header ${header}: ${ip}`);
        return ip;
      }
    }
  }
  // Tentar obter o IP do socket
  if (req.socket && req.socket.remoteAddress) {
    const socketIp = req.socket.remoteAddress;
    if (isValidIp(socketIp)) {
      logger.info(`IP válido extraído do socket: ${socketIp}`);
      return socketIp;
    }
  }
  // Tentar obter o IP do body da requisição
  if (req.body && req.body.user_data && req.body.user_data.ip) {
    const bodyIp = req.body.user_data.ip;
    if (isValidIp(bodyIp)) {
      logger.info(`IP válido extraído do body: ${bodyIp}`);
      return bodyIp;
    }
  }
  logger.warn('Não foi possível extrair um IP válido do cliente');
  return null;
};

module.exports = {
  initialize,
  getLocation,
  lookupIp,
  extractClientIp,
};
