class ApiError extends Error {
  constructor(statusCode, message, details = '', isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
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