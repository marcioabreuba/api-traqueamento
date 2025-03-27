const axios = require('axios');
const httpStatus = require('http-status');
const { v4: uuidv4 } = require('uuid');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const config = require('../config/config');

/**
 * Formato de dados para a Conversions API
 * @param {Object} data
 * @returns {Object} payload formatado para o Facebook
 */
const formatEventData = (data) => {
  const {
    eventName,
    eventTime,
    userData = {},
    customData = {},
    eventSourceUrl,
    eventId = uuidv4(),
  } = data;

  // Processar userData
  const formattedUserData = {
    client_ip_address: userData.ip || null,
    client_user_agent: userData.userAgent || null,
  };

  // Adicionar campos condicionalmente se existirem
  if (userData.email) formattedUserData.em = [userData.email];
  if (userData.phone) formattedUserData.ph = [userData.phone];
  if (userData.firstName) formattedUserData.fn = [userData.firstName];
  if (userData.lastName) formattedUserData.ln = [userData.lastName];
  if (userData.externalId) formattedUserData.external_id = [userData.externalId];
  if (userData.city) formattedUserData.ct = [userData.city];
  if (userData.state) formattedUserData.st = [userData.state];
  if (userData.zipCode) formattedUserData.zp = [userData.zipCode];
  if (userData.country) formattedUserData.country = [userData.country];

  // Construir evento
  const event = {
    event_name: eventName,
    event_time: eventTime,
    user_data: formattedUserData,
    custom_data: customData,
    event_id: eventId,
  };

  // Adicionar URL de origem, se fornecida
  if (eventSourceUrl) {
    event.event_source_url = eventSourceUrl;
  }

  return event;
};

/**
 * Enviar evento para a Conversions API do Facebook
 * @param {string} pixelId - ID do pixel do Facebook
 * @param {string} accessToken - Token de acesso do Facebook
 * @param {Object} eventData - Dados do evento
 * @param {string} testCode - Código de teste opcional
 * @returns {Promise<Object>}
 */
const sendEvent = async (pixelId, accessToken, eventData, testCode = null) => {
  try {
    const formattedEvent = formatEventData(eventData);
    const apiUrl = `${config.facebook.apiUrl}/${pixelId}/events`;

    const payload = {
      data: [formattedEvent],
      access_token: accessToken,
    };

    // Adicionar test_event_code se fornecido
    if (testCode) {
      payload.test_event_code = testCode;
    }

    logger.info(`Enviando evento para pixel ${pixelId}: ${eventData.eventName}`);
    const response = await axios.post(apiUrl, payload);

    return response.data;
  } catch (error) {
    logger.error(`Erro ao enviar evento para o Facebook: ${error.message}`);
    if (error.response) {
      logger.error(`Resposta de erro: ${JSON.stringify(error.response.data)}`);
    }
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Falha ao enviar evento para o Facebook');
  }
};

module.exports = {
  formatEventData,
  sendEvent,
}; 