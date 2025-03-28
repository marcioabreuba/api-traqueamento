const httpStatus = require('http-status');
const config = require('../config/config');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const { Prisma } = require('@prisma/client');

const errorConverter = (err, req, res, next) => {
  let error = err;
  
  // Se não for uma instância de ApiError, converter
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 
      (error instanceof Prisma.PrismaClientKnownRequestError ? httpStatus.BAD_REQUEST : httpStatus.INTERNAL_SERVER_ERROR);
    const message = error.message || httpStatus[statusCode];
    error = new ApiError(statusCode, message, false, err.stack);
  }
  
  next(error);
};

const errorHandler = (err, req, res, next) => {
  try {
    let { statusCode, message } = err;
    
    // Garantir que statusCode seja um número válido
    if (!statusCode || !Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
      statusCode = httpStatus.INTERNAL_SERVER_ERROR;
      logger.error(`Status code inválido encontrado (${statusCode}), usando 500 como fallback`);
    }

    // Garantir que message seja uma string
    if (!message || typeof message !== 'string') {
      message = httpStatus[statusCode] || 'Erro interno do servidor';
    }

    const response = {
      success: false,
      code: statusCode,
      message,
      ...(config.env === 'development' && { stack: err.stack }),
    };

    // Logging apropriado baseado no ambiente
    if (config.env === 'development') {
      logger.error(`Erro detalhado (${statusCode}):`, err);
    } else {
      logger.error({
        code: statusCode,
        message,
        path: req.path,
        method: req.method,
        ip: req.ip,
        bodyParams: JSON.stringify(req.body, null, 2),
        headers: req.headers
      });
    }

    res.status(statusCode).json(response);
  } catch (error) {
    // Fallback para caso de erro no próprio errorHandler
    logger.error('Erro crítico no errorHandler:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Erro interno do servidor'
    });
  }
};

module.exports = {
  errorConverter,
  errorHandler,
};
