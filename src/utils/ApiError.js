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
    super(message || 'Erro interno do servidor');
    
    // Validação explícita do statusCode para garantir que seja um número válido
    if (typeof statusCode !== 'number' || 
        !Number.isInteger(statusCode) || 
        statusCode < 100 || 
        statusCode > 599) {
      this._statusCode = httpStatus.INTERNAL_SERVER_ERROR;
      console.warn(`ApiError: statusCode inválido (${statusCode}). Usando 500 como fallback.`);
    } else {
      this._statusCode = statusCode;
    }
    
    // Usar getters e setters para validar o statusCode
    Object.defineProperty(this, 'statusCode', {
      get: function() {
        return this._statusCode;
      },
      set: function(code) {
        if (typeof code !== 'number' || 
            !Number.isInteger(code) || 
            code < 100 || 
            code > 599) {
          this._statusCode = httpStatus.INTERNAL_SERVER_ERROR;
        } else {
          this._statusCode = code;
        }
      },
      enumerable: true
    });
    
    this.details = details || '';
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    this.name = this.constructor.name;
    
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

module.exports = ApiError;
