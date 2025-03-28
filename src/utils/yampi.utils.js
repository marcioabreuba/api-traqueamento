const crypto = require('crypto');
const config = require('../config/config');
const logger = require('../config/logger');

/**
 * Valida a assinatura do webhook da Yampi
 * @param {string} signature - Assinatura do webhook
 * @param {string} payload - Corpo da requisição em formato string
 * @returns {boolean} - True se a assinatura for válida
 */
const validateWebhookSignature = (signature, payload) => {
  try {
    if (!signature) {
      logger.warn('Assinatura do webhook não fornecida');
      return false;
    }

    // Remove o prefixo 'wh_' da assinatura
    const signatureWithoutPrefix = signature.replace('wh_', '');

    // Cria o hash HMAC usando a chave secreta
    const hmac = crypto.createHmac('sha256', config.yampi.webhookSecret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    // Compara as assinaturas
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signatureWithoutPrefix),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      logger.warn('Assinatura do webhook inválida');
    }

    return isValid;
  } catch (error) {
    logger.error(`Erro ao validar assinatura do webhook: ${error.message}`);
    return false;
  }
};

module.exports = {
  validateWebhookSignature
}; 