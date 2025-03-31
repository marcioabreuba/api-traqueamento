const httpStatus = require('http-status');
const ApiError = require('./ApiError');
const logger = require('../config/logger');

const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    // Registrar o erro original para debug
    logger.error(`Erro capturado por catchAsync: ${err.message}`);
    
    if (err.stack) {
      logger.debug(`Stack trace: ${err.stack}`);
    }
    
    // Verificar se o erro tem um status code válido
    let statusCode = httpStatus.INTERNAL_SERVER_ERROR; // 500 como padrão
    
    if (err instanceof ApiError) {
      // Verificar se o statusCode do ApiError é válido
      if (typeof err.statusCode === 'number' && 
          Number.isInteger(err.statusCode) && 
          err.statusCode >= 100 && 
          err.statusCode < 600) {
        statusCode = err.statusCode;
      } else {
        logger.warn(`ApiError com statusCode inválido: ${err.statusCode}, usando 500 como fallback`);
        // Corrigir o statusCode do erro antes de passá-lo adiante
        err.statusCode = statusCode;
      }
      return next(err);
    }

    // Se for um erro do Prisma, converte para ApiError
    if (err.name === 'PrismaClientKnownRequestError') {
      const apiError = new ApiError(httpStatus.BAD_REQUEST, err.message, false, err.stack);
      return next(apiError);
    }

    // Para outros erros, converte para ApiError com status 500
    const apiError = new ApiError(
      statusCode,
      err.message || 'Erro interno do servidor',
      err.details || false,
      err.stack
    );
    return next(apiError);
  });
};

module.exports = catchAsync;
