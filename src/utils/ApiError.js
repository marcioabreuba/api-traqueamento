const httpStatus = require('http-status');

class ApiError extends Error {
  constructor(statusCode, message, details = '', isOperational = true, stack = '') {
    super(message);
    // Garantir que statusCode sempre seja válido
    this.statusCode =
      statusCode && Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599
        ? statusCode
        : httpStatus.INTERNAL_SERVER_ERROR;
    this.details = details; // Novo campo para detalhes adicionais
    this.isOperational = isOperational;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

module.exports = ApiError;
