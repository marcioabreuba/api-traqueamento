const fs = require('fs');
const path = require('path');
const { Reader } = require('@maxmind/geoip2-node');
const logger = require('../config/logger');

// Armazenar a instância do reader do MaxMind
let reader = null;

// Cache para armazenar resultados
const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas

// Códigos de erro do MaxMind
const MAXMIND_ERROR_CODES = {
  IP_ADDRESS_INVALID: 'IP_ADDRESS_INVALID',
  IP_ADDRESS_REQUIRED: 'IP_ADDRESS_REQUIRED',
  IP_ADDRESS_RESERVED: 'IP_ADDRESS_RESERVED',
  IP_ADDRESS_NOT_FOUND: 'IP_ADDRESS_NOT_FOUND',
  DATABASE_ERROR: 'DATABASE_ERROR'
};

/**
 * Validar formato do IP
 * @param {string} ip - Endereço IP para validar
 * @returns {boolean} Se o IP é válido
 */
const isValidIp = (ip) => {
  if (!ip || typeof ip !== 'string') return false;
  
  // Remover prefixo IPv6 se presente
  const cleanIp = ip.replace(/^::ffff:/, '');
  
  // Regex para IPv4
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  
  // Validação adicional para IPv4
  if (ipv4Regex.test(cleanIp)) {
    // Verificar se há zeros à esquerda em algum octeto
    const octets = cleanIp.split('.');
    const hasLeadingZeros = octets.some(octet => {
      return octet.length > 1 && octet[0] === '0';
    });
    
    return !hasLeadingZeros;
  }
  
  // Regex para IPv6
  const ipv6Patterns = [
    // IPv6 completo
    /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/,
    // IPv6 com zeros comprimidos
    /^((?:[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4})*)?)::((?:[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4})*)?)$/,
    // IPv6 com seção de IPv4 no final
    /^((?:[0-9A-Fa-f]{1,4}:){6,6})(25[0-5]|2[0-4]\d|[0-1]?\d?\d)(\.(25[0-5]|2[0-4]\d|[0-1]?\d?\d)){3}$/,
    // IPv6 comprimido com seção de IPv4 no final
    /^((?:[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4})*)?)::((?:[0-9A-Fa-f]{1,4}:)*)(25[0-5]|2[0-4]\d|[0-1]?\d?\d)(\.(25[0-5]|2[0-4]\d|[0-1]?\d?\d)){3}$/
  ];

  // Testar todos os padrões de IPv6
  return ipv6Patterns.some(pattern => pattern.test(cleanIp));
};

/**
 * Verificar se o banco de dados está atualizado
 * @param {string} dbPath - Caminho do arquivo do banco de dados
 * @returns {boolean} Se o banco está atualizado
 */
const isDatabaseUpToDate = (dbPath) => {
  try {
    const stats = fs.statSync(dbPath);
    const now = new Date();
    const dbAge = now - stats.mtime;
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 dias

    if (dbAge > maxAge) {
      logger.warn(`Banco de dados GeoIP está desatualizado. Idade: ${Math.floor(dbAge / (24 * 60 * 60 * 1000))} dias`);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Erro ao verificar idade do banco de dados:', error);
    return false;
  }
};

/**
 * Inicializar o leitor de base GeoIP
 */
const initialize = async () => {
  try {
    logger.info('Iniciando inicialização do serviço GeoIP');
    
    const possiblePaths = [
      path.join(process.cwd(), 'data', 'GeoLite2-City.mmdb'),
      path.join(__dirname, '../../data/GeoLite2-City.mmdb'),
      '/opt/render/project/src/data/GeoLite2-City.mmdb'
    ];

    let dbPath = null;
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

    try {
      fs.accessSync(dbPath, fs.constants.R_OK);
      logger.info('Arquivo tem permissões de leitura');
    } catch (error) {
      logger.error(`Erro ao verificar permissões: ${error.message}`);
      return false;
    }

    // Verificar se o banco está atualizado
    if (!isDatabaseUpToDate(dbPath)) {
      logger.warn('Banco de dados GeoIP precisa ser atualizado');
    }

    const stats = fs.statSync(dbPath);
    logger.info(`Tamanho do arquivo: ${stats.size} bytes`);

    // Ler o arquivo para a memória (melhor performance)
    const dbBuffer = fs.readFileSync(dbPath);
    
    // Fechar reader anterior se existir
    if (reader) {
      try {
        // Se o reader for da mesma biblioteca pode não ter método close
        if (typeof reader.close === 'function') {
          reader.close();
        }
        logger.info('Reader anterior fechado com sucesso');
      } catch (error) {
        logger.warn('Erro ao fechar reader anterior:', error);
      }
    }

    // Abrir o buffer diretamente - melhor performance
    reader = Reader.openBuffer(dbBuffer);
    logger.info('Base de dados GeoIP aberta com sucesso');

    // Testar com um IP conhecido
    try {
      const testResult = reader.city('8.8.8.8');
      if (testResult) {
        logger.info('Base de dados GeoIP inicializada e testada com sucesso');
        return true;
      }
    } catch (error) {
      logger.error('Falha ao testar base de dados GeoIP:', error);
      return false;
    }
    
    logger.error('Falha ao testar base de dados GeoIP');
    return false;
  } catch (error) {
    logger.error('Erro ao inicializar GeoIP:', error);
    return false;
  }
};

/**
 * Retorna objeto vazio para localização
 * @returns {Object} Template vazio para dados de localização
 */
const getEmptyLocation = () => ({
  country: '',
  city: '',
  subdivision: '',
  postal: '',
  latitude: null,
  longitude: null,
  timezone: ''
});

/**
 * Obter localização de um IP
 * @param {string} ip - Endereço IP para geolocalizar
 * @returns {Object|null} Dados de localização
 */
const getLocation = async (ip) => {
  try {
    if (!reader) {
      logger.warn('Serviço GeoIP não inicializado');
      return getEmptyLocation();
    }

    if (!isValidIp(ip)) {
      logger.warn(`IP inválido: ${ip}`);
      return getEmptyLocation();
    }

    // Verificar cache
    const cachedResult = cache.get(ip);
    if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL) {
      logger.debug(`Retornando resultado do cache para IP: ${ip}`);
      return cachedResult.data;
    }

    try {
      // Usar a API direta do Reader do GeoIP2-node
      const result = reader.city(ip);
      
      // Extrair dados com validação
      const locationData = {
        country: result.country && result.country.names && result.country.names.en || '',
        city: result.city && result.city.names && result.city.names.en || '',
        subdivision: result.subdivisions && result.subdivisions[0] && 
                   result.subdivisions[0].names && result.subdivisions[0].names.en || '',
        postal: result.postal && result.postal.code || '',
        latitude: (result.location && result.location.latitude && 
                  !isNaN(result.location.latitude)) ? result.location.latitude : null,
        longitude: (result.location && result.location.longitude && 
                   !isNaN(result.location.longitude)) ? result.location.longitude : null,
        timezone: result.location && result.location.time_zone || ''
      };

      // Armazenar no cache
      cache.set(ip, {
        data: locationData,
        timestamp: Date.now()
      });

      return locationData;
    } catch (error) {
      // Tratamento específico de erros do GeoIP2-node
      if (error.code === 'IP_ADDRESS_NOT_FOUND') {
        logger.warn(`IP não encontrado na base GeoIP: ${ip}`);
      } else if (error.code === 'IP_ADDRESS_RESERVED') {
        logger.warn(`IP reservado, ignorando geolocalização: ${ip}`);
      } else if (error.message && error.message.includes('Unknown type NaN at offset')) {
        logger.warn(`Erro ao consultar IP ${ip} na base GeoIP: ${error.message}`);
      } else {
        logger.error(`Erro ao buscar localização para IP ${ip}:`, error);
      }
      
      // Retornar objeto vazio em vez de null
      return getEmptyLocation();
    }
  } catch (error) {
    logger.error(`Erro ao buscar localização para IP ${ip}:`, error);
    // Retornar objeto vazio em vez de null para não interromper o fluxo
    return getEmptyLocation();
  }
};

/**
 * Extrair o IP do cliente da requisição
 * @param {Object} req - Objeto de requisição Express
 * @returns {string|null} IP do cliente ou null se não encontrado
 */
const extractClientIp = (req) => {
  logger.debug('Iniciando extração do IP do cliente');
  const headers = req.headers || {};
  logger.debug('Headers disponíveis:', JSON.stringify(headers, null, 2));

  // Lista de headers para tentar obter o IP
  const ipHeaders = [
    'x-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip',
    'x-client-ip'
  ];

  // Tentar obter o IP dos headers
  for (const header of ipHeaders) {
    const value = headers[header];
    if (value) {
      logger.debug(`Header ${header} encontrado: ${value}`);
      const ips = value.split(',').map(ip => ip.trim());
      for (const ip of ips) {
        if (isValidIp(ip)) {
          logger.info(`IP válido extraído do header ${header}: ${ip}`);
          return ip;
        }
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

  // Tentar obter o IP do query string
  if (req.query && req.query.ip) {
    const queryIp = req.query.ip;
    if (isValidIp(queryIp)) {
      logger.info(`IP válido extraído do query string: ${queryIp}`);
      return queryIp;
    }
  }

  // Tentar obter o IP do header de origem
  if (req.headers && req.headers.origin) {
    try {
      const url = new URL(req.headers.origin);
      const hostname = url.hostname;
      if (isValidIp(hostname)) {
        logger.info(`IP válido extraído do header origin: ${hostname}`);
        return hostname;
      }
    } catch (error) {
      logger.debug('Erro ao processar header origin:', error);
    }
  }

  logger.warn('Não foi possível extrair um IP válido do cliente');
  return null;
};

module.exports = {
  initialize,
  getLocation,
  extractClientIp,
  isValidIp,
  MAXMIND_ERROR_CODES
};
