const httpStatus = require('http-status');
const config = require('../config/config');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const { Prisma } = require('@prisma/client');

const errorConverter = (err, req, res, next) => {
  let error = err;
  if (!(error instanceof ApiError)) {
    const statusCode =
      error.statusCode || error instanceof Prisma.PrismaClientKnownRequestError
        ? httpStatus.BAD_REQUEST
        : httpStatus.INTERNAL_SERVER_ERROR;
    const message = error.message || httpStatus[statusCode];
    error = new ApiError(statusCode, message, false, err.stack);
  }
  next(error);
};

const errorHandler = (err, req, res, next) => {
  try {
    let { statusCode, message } = err;
    
    // Garantir que statusCode seja um número válido
    if (!statusCode || !Number.isInteger(statusCode)) {
      statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    }

    // Garantir que o statusCode esteja dentro do intervalo válido
    if (statusCode < 100 || statusCode > 599) {
      statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    }

    if (config.env === 'production' && !err.isOperational) {
      statusCode = httpStatus.INTERNAL_SERVER_ERROR;
      message = httpStatus[httpStatus.INTERNAL_SERVER_ERROR];
    }

    res.locals.errorMessage = err.message;

    const response = {
      code: statusCode,
      message,
      ...(config.env === 'development' && { stack: err.stack }),
    };

    if (config.env === 'development') {
      logger.error(err);
    }

    res.status(statusCode).send(response);
  } catch (error) {
    logger.error('Erro no middleware de erro:', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send({
      code: httpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro interno do servidor'
    });
  }
};

module.exports = {
  errorConverter,
  errorHandler,
};
