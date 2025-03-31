const fs = require('fs');
const path = require('path');
const { Reader } = require('@maxmind/geoip2-node');
const maxmind = require('maxmind'); // Biblioteca alternativa como fallback
const logger = require('../config/logger');

// Armazenar as instâncias dos readers
let reader = null;
let fallbackReader = null;

// Cache para armazenar resultados
const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas em milissegundos

// Códigos de erro do MaxMind
const MAXMIND_ERROR_CODES = {
  IP_ADDRESS_INVALID: 'IP_ADDRESS_INVALID',
  IP_ADDRESS_REQUIRED: 'IP_ADDRESS_REQUIRED',
  IP_ADDRESS_RESERVED: 'IP_ADDRESS_RESERVED',
  IP_ADDRESS_NOT_FOUND: 'IP_ADDRESS_NOT_FOUND',
  DATABASE_ERROR: 'DATABASE_ERROR'
};

// Constantes para o serviço GeoIP
const ERROR_CODES = {
  IP_ADDRESS_INVALID: 'IP_ADDRESS_INVALID',
  DATABASE_ERROR: 'DATABASE_ERROR',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  NAN_TYPE_ERROR: 'NAN_TYPE_ERROR' // Novo código de erro para o problema específico no Render
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
    
    // Limpar o cache ao inicializar
    cache.clear();
    logger.info('Cache limpo');
    
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

    // Inicializar o reader principal (GeoIP2-node)
    try {
      reader = Reader.openBuffer(dbBuffer);
      logger.info('Base de dados GeoIP primária aberta com sucesso');
    } catch (error) {
      logger.error(`Erro ao abrir base de dados primária: ${error.message}`);
      reader = null;
    }
    
    // Inicializar o reader de fallback (maxmind)
    try {
      fallbackReader = await maxmind.open(dbPath);
      logger.info('Base de dados GeoIP de fallback aberta com sucesso');
    } catch (error) {
      logger.error(`Erro ao abrir base de dados de fallback: ${error.message}`);
      fallbackReader = null;
    }

    // Verificar se pelo menos um reader foi inicializado com sucesso
    if (!reader && !fallbackReader) {
      logger.error('Ambos os readers falharam ao inicializar');
      return false;
    }

    // Testar com IPs conhecidos
    let initializationSuccessful = false;
    
    // Testar o reader principal
    if (reader) {
      try {
        const ipv4Result = reader.city('8.8.8.8');
        logger.info('Teste com reader principal bem-sucedido');
        initializationSuccessful = true;
      } catch (error) {
        logger.warn(`Falha no teste com reader principal: ${error.message}`);
      }
    }
    
    // Testar o reader de fallback
    if (fallbackReader && !initializationSuccessful) {
      try {
        const ipv4Result = fallbackReader.get('8.8.8.8');
        logger.info('Teste com reader de fallback bem-sucedido');
        initializationSuccessful = true;
      } catch (error) {
        logger.warn(`Falha no teste com reader de fallback: ${error.message}`);
      }
    }
    
    if (initializationSuccessful) {
      logger.info('Base de dados GeoIP inicializada com sucesso');
      return true;
    } else {
      logger.error('Todos os testes de inicialização do GeoIP falharam');
      return false;
    }
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
    if (!reader && !fallbackReader) {
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

    // Determinar se é IPv4 ou IPv6
    const isIpv6 = ip.includes(':');
    logger.debug(`Tentando obter localização para ${isIpv6 ? 'IPv6' : 'IPv4'}: ${ip}`);

    let result = null;
    let locationData = null;
    let errorMessage = null;

    // Estratégia 1: Tentar com o reader principal (@maxmind/geoip2-node)
    if (reader) {
      try {
        // Tentar com o IP original
        result = reader.city(ip);
        locationData = extractLocationData(result);
        logger.info(`Localização obtida com sucesso pelo reader principal para ${ip}`);
      } catch (primaryError) {
        errorMessage = primaryError.message;
        logger.warn(`Erro ao consultar localização com reader principal para ${ip}: ${errorMessage}`);
        
        // Se o IP é IPv6 com formato ::ffff:IPv4, tentar com o IPv4 embutido
        if (isIpv6 && ip.startsWith('::ffff:')) {
          const ipv4 = ip.substring(7); // Remover o prefixo ::ffff:
          if (isValidIp(ipv4)) {
            logger.info(`Tentando fallback para IPv4 embutido com reader principal: ${ipv4}`);
            try {
              result = reader.city(ipv4);
              locationData = extractLocationData(result);
              logger.info(`Localização obtida com fallback para IPv4 com reader principal: ${ipv4}`);
            } catch (fallbackError) {
              logger.warn(`Falha no fallback para IPv4 com reader principal ${ipv4}: ${fallbackError.message}`);
            }
          }
        }
        // Se for IPv4, tentar com formato IPv6 compatível
        else if (!isIpv6) {
          const ipv6 = `::ffff:${ip}`;
          if (isValidIp(ipv6)) {
            logger.info(`Tentando fallback para IPv6 compatível com reader principal: ${ipv6}`);
            try {
              result = reader.city(ipv6);
              locationData = extractLocationData(result);
              logger.info(`Localização obtida com fallback para IPv6 com reader principal: ${ipv6}`);
            } catch (fallbackError) {
              logger.warn(`Falha no fallback para IPv6 com reader principal ${ipv6}: ${fallbackError.message}`);
            }
          }
        }
      }
    }

    // Estratégia 2: Se o reader principal falhou, tentar com o reader de fallback (maxmind)
    if (!locationData && fallbackReader) {
      try {
        logger.info(`Tentando obter localização com reader de fallback para ${ip}`);
        const fallbackResult = fallbackReader.get(ip);
        
        if (fallbackResult) {
          // Converter do formato maxmind para o formato que o serviço espera
          locationData = {
            country: fallbackResult.country && fallbackResult.country.names && 
                    (fallbackResult.country.names.pt || fallbackResult.country.names['pt-BR'] || fallbackResult.country.names.en) || '',
            city: fallbackResult.city && fallbackResult.city.names && 
                  (fallbackResult.city.names.pt || fallbackResult.city.names['pt-BR'] || fallbackResult.city.names.en) || '',
            subdivision: fallbackResult.subdivisions && fallbackResult.subdivisions[0] && 
                        fallbackResult.subdivisions[0].names && 
                        (fallbackResult.subdivisions[0].names.pt || fallbackResult.subdivisions[0].names['pt-BR'] || fallbackResult.subdivisions[0].names.en) || '',
            postal: fallbackResult.postal && fallbackResult.postal.code || '',
            latitude: (fallbackResult.location && fallbackResult.location.latitude && 
                      !isNaN(fallbackResult.location.latitude)) ? fallbackResult.location.latitude : null,
            longitude: (fallbackResult.location && fallbackResult.location.longitude && 
                      !isNaN(fallbackResult.location.longitude)) ? fallbackResult.location.longitude : null,
            timezone: fallbackResult.location && fallbackResult.location.timeZone || '',
            accuracyRadius: fallbackResult.location && fallbackResult.location.accuracyRadius || null
          };
          
          logger.info(`Localização obtida com sucesso pelo reader de fallback para ${ip}`);
        } else {
          logger.warn(`Reader de fallback não encontrou dados para ${ip}`);
        }
        
        // Se for IPv6 com IPv4 embutido, tentar com o IPv4
        if (!locationData && isIpv6 && ip.startsWith('::ffff:')) {
          const ipv4 = ip.substring(7);
          if (isValidIp(ipv4)) {
            logger.info(`Tentando fallback para IPv4 embutido com reader de fallback: ${ipv4}`);
            const ipv4Result = fallbackReader.get(ipv4);
            
            if (ipv4Result) {
              locationData = {
                country: ipv4Result.country && ipv4Result.country.names && 
                        (ipv4Result.country.names.pt || ipv4Result.country.names['pt-BR'] || ipv4Result.country.names.en) || '',
                city: ipv4Result.city && ipv4Result.city.names && 
                      (ipv4Result.city.names.pt || ipv4Result.city.names['pt-BR'] || ipv4Result.city.names.en) || '',
                subdivision: ipv4Result.subdivisions && ipv4Result.subdivisions[0] && 
                            ipv4Result.subdivisions[0].names && 
                            (ipv4Result.subdivisions[0].names.pt || ipv4Result.subdivisions[0].names['pt-BR'] || ipv4Result.subdivisions[0].names.en) || '',
                postal: ipv4Result.postal && ipv4Result.postal.code || '',
                latitude: (ipv4Result.location && ipv4Result.location.latitude && 
                          !isNaN(ipv4Result.location.latitude)) ? ipv4Result.location.latitude : null,
                longitude: (ipv4Result.location && ipv4Result.location.longitude && 
                          !isNaN(ipv4Result.location.longitude)) ? ipv4Result.location.longitude : null,
                timezone: ipv4Result.location && ipv4Result.location.timeZone || '',
                accuracyRadius: ipv4Result.location && ipv4Result.location.accuracyRadius || null
              };
              logger.info(`Localização obtida com fallback para IPv4 com reader de fallback: ${ipv4}`);
            }
          }
        }
      } catch (fallbackError) {
        logger.warn(`Erro ao consultar localização com reader de fallback para ${ip}: ${fallbackError.message}`);
      }
    }

    // Se ainda não temos dados, retornar objeto vazio
    if (!locationData) {
      // Tratamento específico para diferentes tipos de erros
      if (errorMessage) {
        if (errorMessage.includes('IP_ADDRESS_NOT_FOUND')) {
          logger.warn(`IP não encontrado na base GeoIP: ${ip}`);
        } else if (errorMessage.includes('IP_ADDRESS_RESERVED')) {
          logger.warn(`IP reservado, ignorando geolocalização: ${ip}`);
        } else if (errorMessage.includes('Unknown type NaN at offset')) {
          logger.warn(`Erro na base de dados ao consultar IP ${ip}: ${errorMessage}`);
        } else {
          logger.error(`Erro ao buscar localização para IP ${ip}: ${errorMessage}`);
        }
      }
      
      return getEmptyLocation();
    }

    // Armazenar no cache
    cache.set(ip, {
      data: locationData,
      timestamp: Date.now()
    });

    return locationData;
  } catch (error) {
    logger.error(`Erro ao buscar localização para IP ${ip}:`, error);
    // Retornar objeto vazio em vez de null para não interromper o fluxo
    return getEmptyLocation();
  }
};

/**
 * Extrai dados de localização estruturados da resposta do MaxMind
 * @param {Object} result - Resultado da consulta do MaxMind
 * @returns {Object} Dados estruturados de localização
 */
const extractLocationData = (result) => {
  if (!result) return getEmptyLocation();
  
  return {
    country: result.country && result.country.names && 
             (result.country.names.pt || result.country.names['pt-BR'] || result.country.names.en) || '',
    city: result.city && result.city.names && 
          (result.city.names.pt || result.city.names['pt-BR'] || result.city.names.en) || '',
    subdivision: result.subdivisions && result.subdivisions[0] && 
                result.subdivisions[0].names && 
                (result.subdivisions[0].names.pt || result.subdivisions[0].names['pt-BR'] || result.subdivisions[0].names.en) || '',
    postal: result.postal && result.postal.code || '',
    latitude: (result.location && result.location.latitude && 
               !isNaN(result.location.latitude)) ? result.location.latitude : null,
    longitude: (result.location && result.location.longitude && 
                !isNaN(result.location.longitude)) ? result.location.longitude : null,
    timezone: result.location && result.location.timeZone || '',
    accuracyRadius: result.location && result.location.accuracyRadius || null
  };
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

  // Função para extrair e validar IPs de uma string
  const extractValidIps = (ipString) => {
    if (!ipString) return [];
    const ips = ipString.split(',').map(ip => ip.trim());
    
    // Separar IPv6 e IPv4
    const ipv6Addresses = [];
    const ipv4Addresses = [];
    
    for (const ip of ips) {
      // Remover prefixo IPv6 se presente para validação correta
      const cleanIp = ip.replace(/^::ffff:/, '');
      
      // Validar IPv6
      if (cleanIp.includes(':')) {
        if (isValidIp(ip)) {
          logger.debug(`IPv6 válido encontrado: ${ip}`);
          ipv6Addresses.push(ip);
        }
      } 
      // Validar IPv4
      else if (cleanIp.includes('.')) {
        if (isValidIp(cleanIp)) {
          logger.debug(`IPv4 válido encontrado: ${cleanIp}`);
          ipv4Addresses.push(cleanIp);
        }
      }
    }
    
    // Retorna primeiro os endereços IPv6, depois IPv4
    return [...ipv6Addresses, ...ipv4Addresses];
  };

  // Tentar obter o IP dos headers
  for (const header of ipHeaders) {
    const value = headers[header];
    if (value) {
      logger.debug(`Header ${header} encontrado: ${value}`);
      const validIps = extractValidIps(value);
      
      if (validIps.length > 0) {
        const selectedIp = validIps[0]; // Usar o primeiro IP (prioriza IPv6)
        const isIpv6 = selectedIp.includes(':');
        logger.info(`IP válido extraído do header ${header}: ${selectedIp} (${isIpv6 ? 'IPv6' : 'IPv4'})`);
        return selectedIp;
      }
    }
  }

  // Tentar obter o IP do socket
  if (req.socket && req.socket.remoteAddress) {
    const socketIp = req.socket.remoteAddress;
    if (isValidIp(socketIp)) {
      const isIpv6 = socketIp.includes(':');
      logger.info(`IP válido extraído do socket: ${socketIp} (${isIpv6 ? 'IPv6' : 'IPv4'})`);
      return socketIp;
    }
  }

  // Tentar obter o IP do body da requisição
  if (req.body && req.body.user_data && req.body.user_data.ip) {
    const bodyIp = req.body.user_data.ip;
    if (isValidIp(bodyIp)) {
      const isIpv6 = bodyIp.includes(':');
      logger.info(`IP válido extraído do body: ${bodyIp} (${isIpv6 ? 'IPv6' : 'IPv4'})`);
      return bodyIp;
    }
  }

  // Tentar obter o IP do query string
  if (req.query && req.query.ip) {
    const queryIp = req.query.ip;
    if (isValidIp(queryIp)) {
      const isIpv6 = queryIp.includes(':');
      logger.info(`IP válido extraído do query string: ${queryIp} (${isIpv6 ? 'IPv6' : 'IPv4'})`);
      return queryIp;
    }
  }

  // Tentar obter o IP do header de origem
  if (req.headers && req.headers.origin) {
    try {
      const url = new URL(req.headers.origin);
      const hostname = url.hostname;
      if (isValidIp(hostname)) {
        const isIpv6 = hostname.includes(':');
        logger.info(`IP válido extraído do header origin: ${hostname} (${isIpv6 ? 'IPv6' : 'IPv4'})`);
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
  MAXMIND_ERROR_CODES,
  ERROR_CODES
};
