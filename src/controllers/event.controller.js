const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { eventService } = require('../services');
const ApiError = require('../utils/ApiError');
const pick = require('../utils/pick');
const logger = require('../config/logger');
const { eventValidation } = require('../validations');

/**
 * Criar novo evento
 */
const createEvent = catchAsync(async (req, res) => {
  try {
    logger.info('Recebendo novo evento');
    logger.debug(`Dados recebidos: ${JSON.stringify(req.body)}`);

    // Verificar se o corpo da requisição está vazio
    if (!req.body || Object.keys(req.body).length === 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Corpo da requisição vazio ou inválido',
        'EmptyRequestBodyError'
      );
    }

    // Validar dados do evento
    try {
      // Validação corrigida: Certifique-se de que o schema permite o campo "app"
      const { error } = eventValidation.createEvent.body.validate(req.body, { 
        allowUnknown: false,
        abortEarly: false // Retorna todos os erros ao invés de apenas o primeiro
      });
      
      if (error) {
        const errorDetails = error.details.map((x) => x.message).join(', ');
        logger.error(`Erro na validação dos dados: ${errorDetails}`);
        throw new ApiError(
          httpStatus.BAD_REQUEST, 
          `Erro de validação: ${errorDetails}`, 
          error.details
        );
      }
    } catch (error) {
      logger.error(`Erro na validação dos dados: ${error.message}`);
      // Se não for uma ApiError, converte para uma
      if (!(error instanceof ApiError)) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Erro de validação: ${error.message}`,
          error.details || 'Erro na validação de dados'
        );
      }
      throw error; // Se já for uma ApiError, apenas propague
    }

    // Extrair domínio do header ou do payload
    const domain = req.headers['x-domain'] || req.body.domain;
    logger.info(`Domínio extraído: ${domain || 'não fornecido'}`);

    // Processar evento
    const event = await eventService.processEvent(req.body, domain);

    return res.status(httpStatus.CREATED).json({
      success: true,
      data: event,
    });
  } catch (error) {
    logger.error('Erro ao processar evento:', error);
    if (error.statusCode) {
      logger.error(`Status code do erro: ${error.statusCode}`);
    }
    logger.error(`É instância de ApiError? ${error instanceof ApiError}`);

    // Tratamento específico para erros de validação
    if (error.message && (error.message.includes('validação') || error.message.includes('validation'))) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        error: error.message,
        details: error.details || 'Erro na validação dos dados',
        code: httpStatus.BAD_REQUEST
      });
    }

    // Tratamento de erros ApiError
    if (error instanceof ApiError) {
      // Garante que o status code será um valor válido
      const statusCode = error.statusCode && 
                         Number.isInteger(error.statusCode) && 
                         error.statusCode >= 100 && 
                         error.statusCode <= 599 
                         ? error.statusCode 
                         : httpStatus.INTERNAL_SERVER_ERROR;
      
      return res.status(statusCode).json({
        success: false,
        error: error.message || 'Erro interno',
        details: error.details || 'Erro interno',
        code: statusCode
      });
    }

    // Fallback para erros não tratados
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Erro interno do servidor ao processar evento',
      details: error.message || 'Erro desconhecido',
      code: httpStatus.INTERNAL_SERVER_ERROR
    });
  }
});

/**
 * Obter evento específico pelo ID
 */
const getEvent = catchAsync(async (req, res) => {
  const event = await eventService.getEventById(req.params.eventId);
  if (!event) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Evento não encontrado');
  }
  res.status(httpStatus.OK).json({
    success: true,
    data: event,
  });
});

/**
 * Obter lista de eventos com filtros
 */
const getEvents = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['pixelId', 'eventName', 'status']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await eventService.queryEvents(filter, options);
  res.status(httpStatus.OK).json({
    success: true,
    ...result,
  });
});

module.exports = {
  createEvent,
  getEvent,
  getEvents,
};
