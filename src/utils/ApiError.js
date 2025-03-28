const httpStatus = require('http-status');

/**
 * Classe de erro para API com campos adicionais para melhor tratamento
 */
class ApiError extends Error {
  /**
   * Cria uma instância de ApiError
   * @param {number} statusCode - Código de status HTTP
   * @param {string} message - Mensagem de erro
   * @param {any} details - Detalhes adicionais do erro (opcional)
   * @param {boolean} isOperational - Se é um erro operacional conhecido (opcional)
   * @param {string} stack - Stack trace do erro (opcional)
   */
  constructor(statusCode, message, details = '', isOperational = true, stack = '') {
    super(message);
    
    // Garantir que statusCode sempre seja válido
    this.statusCode = statusCode && Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599 
      ? statusCode 
      : httpStatus.INTERNAL_SERVER_ERROR;
    
    this.details = details; // Detalhes adicionais do erro
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

module.exports = ApiError;
