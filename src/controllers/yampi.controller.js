const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const yampiService = require('../services/yampi.service');
const { validateWebhookSignature } = require('../utils/yampi.utils');
const logger = require('../config/logger');

/**
 * Processa webhook da Yampi
 */
const processWebhook = catchAsync(async (req, res) => {
  logger.info('Recebido webhook da Yampi');

  // Validar assinatura do webhook
  const signature = req.headers['x-yampi-signature'];
  const payload = JSON.stringify(req.body);

  if (!validateWebhookSignature(signature, payload)) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Assinatura do webhook inválida');
  }

  // Processar webhook
  await yampiService.processWebhook(req.body);

  res.status(httpStatus.OK).send({ message: 'Webhook processado com sucesso' });
});

module.exports = {
  processWebhook
}; 