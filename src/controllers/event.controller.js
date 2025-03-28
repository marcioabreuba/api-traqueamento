const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { eventService, geoipService } = require('../services');
const ApiError = require('../utils/ApiError');
const pick = require('../utils/pick');
const logger = require('../config/logger');

/**
 * Criar novo evento
 */
const createEvent = catchAsync(async (req, res) => {
  try {
    logger.info('Iniciando processamento de novo evento');

    // Extrair IP do cliente se não fornecido nos dados do usuário
    if (!req.body.user_data?.ip_address) {
      const clientIp = req.ip || req.connection.remoteAddress;
      req.body.user_data = req.body.user_data || {};
      req.body.user_data.ip_address = clientIp;
      logger.info(`IP do cliente extraído: ${clientIp}`);

      // Tentar enriquecer com informações de geolocalização
      try {
        logger.debug('Iniciando busca de dados GeoIP');
        const geoData = await geoipService.lookupIp(clientIp);
        logger.info(`Dados GeoIP obtidos: ${JSON.stringify(geoData)}`);
        
        if (geoData) {
          if (!req.body.user_data.city && geoData.city) {
            req.body.user_data.city = geoData.city;
            logger.info(`Cidade enriquecida: ${geoData.city}`);
          }
          if (!req.body.user_data.state && geoData.state) {
            req.body.user_data.state = geoData.state;
            logger.info(`Estado enriquecido: ${geoData.state}`);
          }
          if (!req.body.user_data.country && geoData.country) {
            req.body.user_data.country = geoData.country;
            logger.info(`País enriquecido: ${geoData.country}`);
          }
          if (geoData.latitude && geoData.longitude) {
            logger.debug(`Coordenadas obtidas: ${geoData.latitude}, ${geoData.longitude}`);
          }
        } else {
          logger.warn(`Nenhum dado GeoIP encontrado para o IP: ${clientIp}`);
        }
      } catch (error) {
        logger.error(`Erro ao obter dados de geolocalização: ${error.message}`);
        logger.error(`Stack trace: ${error.stack}`);
      }
    } else {
      logger.info('Dados de usuário já contêm IP, pulando enriquecimento GeoIP');
    }

    // Extrair user-agent se não fornecido
    if (!req.body.user_data?.user_agent && req.headers['user-agent']) {
      req.body.user_data = req.body.user_data || {};
      req.body.user_data.user_agent = req.headers['user-agent'];
      logger.debug('User-Agent extraído dos headers');
    }

    // Definir timestamp atual se não fornecido
    if (!req.body.event_time) {
      req.body.event_time = Math.floor(Date.now() / 1000);
      logger.debug(`Timestamp definido: ${req.body.event_time}`);
    }

    // Adicionar URL de origem se disponível
    if (req.headers.referer) {
      req.body.event_source_url = req.headers.referer;
      logger.debug(`URL de origem adicionada: ${req.headers.referer}`);
    }

    // Processar e enviar evento
    const domain = req.params.domain || req.query.domain || req.body.domain;
    logger.info(`Processando evento para domínio: ${domain}`);
    
    const event = await eventService.processEvent(req.body, domain);
    logger.info(`Evento processado com sucesso. ID: ${event.id}`);
    
    return res.status(httpStatus.CREATED).json({
      success: true,
      data: event
    });
  } catch (error) {
    logger.error('Erro ao processar evento:', error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
});

/**
 * Obter evento por ID
 */
const getEvent = catchAsync(async (req, res) => {
  try {
    const event = await eventService.getEventById(req.params.eventId);
    if (!event) {
      return res.status(httpStatus.NOT_FOUND).json({
        success: false,
        error: 'Evento não encontrado'
      });
    }
    return res.status(httpStatus.OK).json({
      success: true,
      data: event
    });
  } catch (error) {
    logger.error('Erro ao buscar evento:', error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
});

/**
 * Listar eventos
 */
const getEvents = catchAsync(async (req, res) => {
  try {
    const filter = pick(req.query, ['pixelId', 'eventName', 'status']);
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const result = await eventService.queryEvents(filter, options);
    return res.status(httpStatus.OK).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Erro ao listar eventos:', error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
});

module.exports = {
  createEvent,
  getEvent,
  getEvents,
}; 