const httpStatus = require('http-status');
const config = require('../config/config');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const { Prisma } = require('@prisma/client');

/**
 * Converte erros genéricos para ApiError
 */
const errorConverter = (err, req, res, next) => {
  let error = err;
  
  // Se não for uma instância de ApiError, converter
  if (!(error instanceof ApiError)) {
    // Determinar código de status apropriado
    let statusCode = error.statusCode;
    
    // Verificar se é um erro conhecido do Prisma e atribuir BAD_REQUEST
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      statusCode = httpStatus.BAD_REQUEST;
    } 
    // Tratar códigos de status desconhecidos como erros internos
    else if (!statusCode || !Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
      statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    }
    
    const message = error.message || httpStatus[statusCode];
    error = new ApiError(statusCode, message, error.details || '', false, err.stack);
  }
  
  next(error);
};

/**
 * Trata os erros e envia resposta apropriada
 */
const errorHandler = (err, req, res, next) => {
  try {
    // A classe ApiError já garante que statusCode é válido
    const statusCode = err.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
    
    // Garantir que a mensagem seja uma string válida
    const message = (err.message && typeof err.message === 'string') 
      ? err.message 
      : httpStatus[statusCode] || 'Erro interno do servidor';

    // Construir objeto de resposta
    const response = {
      success: false,
      code: statusCode,
      message,
    };
    
    // Adicionar detalhes se existirem
    if (err.details) {
      response.details = err.details;
    }
    
    // Incluir stack trace em desenvolvimento
    if (config.env === 'development') {
      response.stack = err.stack;
      logger.error(`Erro detalhado [${statusCode}]:`, err);
    } else {
      // Log mais conciso em produção
      logger.error({
        statusCode,
        message,
        details: err.details,
        path: req.path,
        method: req.method,
        ip: req.ip,
        body: req.body ? JSON.stringify(req.body, null, 2) : undefined
      });
    }

    // Enviar resposta
    return res.status(statusCode).json(response);
  } catch (error) {
    // Fallback para caso de erro no próprio errorHandler
    logger.error('Erro crítico no errorHandler:', error);
    
    return res.status(500).json({
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
