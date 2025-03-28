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
  let { statusCode, message } = err;
  
  // Garantir que statusCode seja um número válido
  if (!statusCode || !Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
  }

  // Garantir que message seja uma string
  if (!message || typeof message !== 'string') {
    message = httpStatus[statusCode];
  }

  const response = {
    success: false,
    code: statusCode,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  };

  // Logging apropriado baseado no ambiente
  if (process.env.NODE_ENV === 'development') {
    logger.error('Erro detalhado:', err);
  } else {
    logger.error({
      code: statusCode,
      message,
      path: req.path,
      method: req.method,
      ip: req.ip,
      body: req.body,
      headers: req.headers
    });
  }

  res.status(statusCode).json(response);
};

module.exports = {
  errorConverter,
  errorHandler,
};
