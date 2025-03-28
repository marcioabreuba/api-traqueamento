const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { eventService, geoipService } = require('../services');
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

    // Validar dados do evento
    try {
      // Validação corrigida: Certifique-se de que o schema permite o campo "app"
      const { error } = eventValidation.createEvent.body.validate(req.body, { allowUnknown: false });
      if (error) {
        logger.error('Erro na validação dos dados:', error);
        throw new ApiError(
          httpStatus.BAD_REQUEST, // Status code primeiro
          `Erro de validação: ${error.details.map(x => x.message).join(', ')}` // Message depois
        );
      }
    } catch (error) {
      logger.error('Erro na validação dos dados:', error);
      throw error; // Já é uma ApiError, apenas propague
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
    logger.error(`Status code do erro: ${error.statusCode}`);
    logger.error(`É instância de ApiError? ${error instanceof ApiError}`);

    // Tratamento específico para erros de validação
    if (error.message.includes('validação') || error.message.includes('validation')) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        error: error.message,
        details: error.details || 'Erro na validação dos dados'
      });
    }

    // Tratamento de erros ApiError
    if (error instanceof ApiError) {
      return res.status(error.statusCode || httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: error.message,
        details: error.details || 'Erro interno'
      });
    }

    // Fallback para erros não tratados
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Erro interno do servidor ao processar evento',
      details: error.message || 'Erro desconhecido'
    });
  }
});

// ... (getEvent e getEvents permanecem iguais)

module.exports = {
  createEvent,
  getEvent,
  getEvents,
};