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
      throw new ApiError(httpStatus.BAD_REQUEST, 'Corpo da requisição vazio ou inválido', 'EmptyRequestBodyError');
    }

    // Validar dados do evento
    try {
      // Validação corrigida: Certifique-se de que o schema permite o campo "app"
      const { error } = eventValidation.createEvent.body.validate(req.body, {
        allowUnknown: false,
        abortEarly: false, // Retorna todos os erros ao invés de apenas o primeiro
      });

      if (error) {
        const errorDetails = error.details.map((x) => x.message).join(', ');
        logger.error(`Erro na validação dos dados: ${errorDetails}`);
        throw new ApiError(httpStatus.BAD_REQUEST, `Erro de validação: ${errorDetails}`, error.details);
      }
    } catch (error) {
      logger.error(`Erro na validação dos dados: ${error.message}`);
      // Se não for uma ApiError, converte para uma
      if (!(error instanceof ApiError)) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Erro de validação: ${error.message}`,
          error.details || 'Erro na validação de dados',
        );
      }
      throw error; // Se já for uma ApiError, apenas propague
    }

    // Extrair domínio do header ou do payload
    const domain = req.headers['x-domain'] || req.body.domain;
    logger.info(`Domínio extraído: ${domain || 'não fornecido'}`);

    // Processar evento
    const event = await eventService.processEvent(req.body, domain);
    console.log('event', event);
    res.send();
  } catch (originalError) {
    // Garantir que sempre temos um erro com objeto e mensagem
    let error = originalError;

    if (!error) {
      error = new Error('Erro desconhecido durante processamento do evento');
    }

    if (typeof error === 'string') {
      error = new Error(error);
    }

    // Garantir que a mensagem de erro sempre existe
    const errorMessage = error.message || 'Erro desconhecido';
    logger.error(`Erro ao processar evento: ${errorMessage}`);

    // Garantir que statusCode sempre é um valor válido
    let statusCode = httpStatus.INTERNAL_SERVER_ERROR; // 500 como padrão

    if (error.statusCode) {
      if (Number.isInteger(error.statusCode) && error.statusCode >= 100 && error.statusCode <= 599) {
        statusCode = error.statusCode;
      } else {
        logger.error(`Status code inválido: ${error.statusCode}, usando 500 como fallback`);
      }
    } else {
      logger.error('Status code não definido, usando 500');
    }

    // Sempre definir um statusCode válido no objeto de erro
    error.statusCode = statusCode;
    logger.error(`Status code final do erro: ${statusCode}`);

    logger.error(`É instância de ApiError? ${error instanceof ApiError}`);

    // Tratamento específico para erros de validação
    if (errorMessage && (errorMessage.includes('validação') || errorMessage.includes('validation'))) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        error: errorMessage,
        details: error.details || 'Erro na validação dos dados',
        code: httpStatus.BAD_REQUEST,
      });
    }

    // Tratamento de erros ApiError
    if (error instanceof ApiError) {
      logger.error(`Erro detalhado [${statusCode}]: ${errorMessage}`);

      return res.status(statusCode).json({
        success: false,
        error: errorMessage,
        details: error.details || 'Erro interno',
        code: statusCode,
      });
    }

    // Fallback para erros não tratados
    logger.error(`Erro detalhado [${statusCode}]: ${errorMessage}`);

    return res.status(statusCode).json({
      success: false,
      error: 'Erro interno do servidor ao processar evento',
      details: errorMessage,
      code: statusCode,
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
