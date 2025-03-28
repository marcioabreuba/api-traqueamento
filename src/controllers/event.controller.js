const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { eventService, geoipService } = require('../services');
const ApiError = require('../utils/ApiError');
const pick = require('../utils/pick');
const logger = require('../config/logger');
const { validateEventData, validateUserData, normalizeLocation } = require('../utils/validators');

/**
 * Criar novo evento
 */
const createEvent = catchAsync(async (req, res) => {
  try {
    logger.info('Iniciando processamento de novo evento');
    logger.info('Headers recebidos:', JSON.stringify(req.headers, null, 2));
    logger.info('Body recebido:', JSON.stringify(req.body, null, 2));
    logger.info('Query params:', JSON.stringify(req.query, null, 2));
    
    // Extrair IP do cliente
    const clientIp = req.ip || req.connection.remoteAddress;
    logger.info(`IP do cliente extraído: ${clientIp}`);

    // Validar e normalizar dados do evento
    try {
      const eventData = validateEventData(req.body);
      if (!eventData) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Dados do evento inválidos');
      }

      // Validar e normalizar dados do usuário
      if (eventData.user_data) {
        eventData.user_data = validateUserData(eventData.user_data);
        if (!eventData.user_data) {
          throw new ApiError(httpStatus.BAD_REQUEST, 'Dados do usuário inválidos');
        }
      }

      // Tentar enriquecer com informações de geolocalização
      try {
        logger.debug('Iniciando busca de dados GeoIP');
        const geoData = await geoipService.lookupIp(clientIp);
        
        if (geoData) {
          const normalizedLocation = normalizeLocation(geoData);
          if (normalizedLocation) {
            eventData.user_data = {
              ...eventData.user_data,
              ...normalizedLocation
            };
            logger.info('Dados de geolocalização enriquecidos com sucesso');
          }
        }
      } catch (error) {
        logger.error(`Erro ao obter dados de geolocalização: ${error.message}`);
        logger.error(`Stack trace: ${error.stack}`);
      }

      // Extrair user-agent se não fornecido
      if (!eventData.user_data?.user_agent && req.headers['user-agent']) {
        eventData.user_data = eventData.user_data || {};
        eventData.user_data.user_agent = req.headers['user-agent'];
        logger.debug('User-Agent extraído dos headers');
      }

      // Adicionar URL de origem se disponível
      if (req.headers.referer) {
        eventData.event_source_url = req.headers.referer;
        logger.debug(`URL de origem adicionada: ${req.headers.referer}`);
      }

      // Processar o evento
      const event = await eventService.createEvent(eventData, clientIp);
      
      // Enviar resposta de sucesso
      res.status(httpStatus.CREATED).json({
        success: true,
        data: event
      });
    } catch (error) {
      logger.error('Erro na validação dos dados:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        error.message || 'Erro na validação dos dados'
      );
    }
  } catch (error) {
    logger.error('Erro ao processar evento:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error.message || 'Erro ao processar evento',
      false,
      error.stack
    );
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