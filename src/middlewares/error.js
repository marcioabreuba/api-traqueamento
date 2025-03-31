const httpStatus = require('http-status');
const { Prisma } = require('@prisma/client');
const config = require('../config/config');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');

/**
 * Converte erros genéricos para ApiError
 */
const errorConverter = (err, req, res, next) => {
  let error = err;

  // Se não for uma instância de ApiError, converter
  if (!(error instanceof ApiError)) {
    // Determinar código de status apropriado
    let { statusCode } = error;

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
    // Log inicial do erro recebido (apenas para debug)
    logger.debug(`ErrorHandler recebeu: ${JSON.stringify({
      message: err.message,
      statusCode: err.statusCode,
      name: err.name,
      isApiError: err instanceof ApiError
    })}`);

    // Verificar explicitamente se o statusCode é válido
    let statusCode = httpStatus.INTERNAL_SERVER_ERROR; // 500 como padrão seguro
    
    if (err && err.statusCode !== undefined) {
      // Tentar converter para número se for string
      const parsedStatus = typeof err.statusCode === 'string' 
        ? parseInt(err.statusCode, 10) 
        : err.statusCode;
        
      // Verificar se é um número válido para HTTP status
      if (
        typeof parsedStatus === 'number' &&
        Number.isInteger(parsedStatus) &&
        parsedStatus >= 100 &&
        parsedStatus < 600
      ) {
        statusCode = parsedStatus;
        logger.debug(`Usando status code do erro: ${statusCode}`);
      } else {
        logger.warn(`Status code inválido recebido: '${err.statusCode}' (${typeof err.statusCode}), usando 500 como fallback`);
      }
    } else {
      logger.warn('Erro sem status code, usando 500 como fallback');
    }

    // Garantir que a mensagem seja uma string válida
    const message = (err && err.message && typeof err.message === 'string')
      ? err.message
      : httpStatus[statusCode] || 'Erro interno do servidor';

    // Construir objeto de resposta
    const response = {
      success: false,
      code: statusCode,
      message
    };

    // Adicionar detalhes se existirem
    if (err && err.details) {
      response.details = err.details;
    }

    // Incluir stack trace em desenvolvimento
    if (config.env === 'development') {
      if (err && err.stack) {
        response.stack = err.stack;
      }
      logger.error(`Erro detalhado [${statusCode}]:`, err);
    } else {
      // Log mais conciso em produção
      logger.error({
        statusCode,
        message,
        details: err && err.details,
        path: req.path,
        method: req.method,
        ip: req.ip,
        body: req.body ? JSON.stringify(req.body, null, 2) : undefined
      });
    }

    // Log de confirmação antes de enviar resposta
    logger.debug(`Enviando resposta HTTP ${statusCode}`);

    // Enviar resposta com statusCode validado
    return res.status(statusCode).json(response);
  } catch (error) {
    // Fallback para caso de erro no próprio errorHandler
    logger.error(`Erro crítico no errorHandler: ${error.message || 'Erro desconhecido'}`);
    if (error.stack) {
      logger.error(`Stack do erro crítico: ${error.stack}`);
    }

    // Resposta de emergência para garantir que o cliente receba algo
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Erro interno do servidor'
    });
  }
};

module.exports = {
  errorConverter,
  errorHandler
};
