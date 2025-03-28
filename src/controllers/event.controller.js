const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { eventService, geoipService } = require('../services');
const ApiError = require('../utils/ApiError');
const pick = require('../utils/pick');
const logger = require('../config/logger');
const { validateEventData, validateUserData, normalizeLocation } = require('../utils/validators');
const eventValidation = require('../validations/event.validation');

/**
 * Criar novo evento
 */
const createEvent = catchAsync(async (req, res) => {
  try {
    logger.info('Recebendo novo evento');
    logger.debug(`Dados recebidos: ${JSON.stringify(req.body)}`);

    // Validar dados do evento
    try {
      const { error } = eventValidation.body.validate(req.body);
      if (error) {
        logger.error('Erro na validação dos dados:', error);
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          error.details.map(x => x.message).join(', ')
        );
      }
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

    // Extrair domínio do header ou do payload
    const domain = req.headers['x-domain'] || req.body.domain;
    logger.info(`Domínio extraído: ${domain || 'não fornecido'}`);

    // Processar evento
    const event = await eventService.processEvent(req.body, domain);
    
    return res.status(httpStatus.CREATED).json({
      success: true,
      data: event
    });
  } catch (error) {
    logger.error('Erro ao processar evento:', error);
    
    // Tratamento específico para erros de pixel_id
    if (error.message.includes('pixel_id') || error.message.includes('Pixel ID')) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        error: 'Erro na configuração do pixel. Verifique se o pixel_id está presente no payload ou se existe uma configuração válida para o domínio.',
        details: error.message
      });
    }

    // Tratamento específico para erros de validação
    if (error.message.includes('validação') || error.message.includes('validation')) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        error: 'Erro na validação dos dados',
        details: error.message
      });
    }

    // Tratamento específico para erros do Facebook
    if (error.message.includes('Facebook') || error.message.includes('facebook')) {
      return res.status(httpStatus.BAD_GATEWAY).json({
        success: false,
        error: 'Erro ao enviar evento para o Facebook',
        details: error.message
      });
    }

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message
      });
    }

    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Erro interno do servidor ao processar evento',
      details: error.message
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