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
  logger.debug('Iniciando formatação dos dados do evento');
  
  const {
    eventName,
    eventTime,
    userData = {},
    customData = {},
    eventSourceUrl,
    eventId = uuidv4(),
  } = data;

  logger.info(`Formatando evento: ${eventName} (ID: ${eventId})`);

  // Processar userData
  const formattedUserData = {
    client_ip_address: userData.ip || null,
    client_user_agent: userData.userAgent || null,
  };

  // Adicionar campos condicionalmente se existirem
  if (userData.email) {
    formattedUserData.em = [userData.email];
    logger.debug('Email adicionado aos dados do usuário');
  }
  if (userData.phone) {
    formattedUserData.ph = [userData.phone];
    logger.debug('Telefone adicionado aos dados do usuário');
  }
  if (userData.firstName) {
    formattedUserData.fn = [userData.firstName];
    logger.debug('Nome adicionado aos dados do usuário');
  }
  if (userData.lastName) {
    formattedUserData.ln = [userData.lastName];
    logger.debug('Sobrenome adicionado aos dados do usuário');
  }
  if (userData.externalId) {
    formattedUserData.external_id = [userData.externalId];
    logger.debug('ID externo adicionado aos dados do usuário');
  }
  if (userData.city) {
    formattedUserData.ct = [userData.city];
    logger.debug(`Cidade adicionada aos dados do usuário: ${userData.city}`);
  }
  if (userData.state) {
    formattedUserData.st = [userData.state];
    logger.debug(`Estado adicionado aos dados do usuário: ${userData.state}`);
  }
  if (userData.zipCode) {
    formattedUserData.zp = [userData.zipCode];
    logger.debug(`CEP adicionado aos dados do usuário: ${userData.zipCode}`);
  }
  if (userData.country) {
    formattedUserData.country = [userData.country];
    logger.debug(`País adicionado aos dados do usuário: ${userData.country}`);
  }

  // Construir evento
  const event = {
    event_name: eventName,
    event_time: eventTime,
    user_data: formattedUserData,
    custom_data: customData,
    event_id: eventId,
    action_source: 'website', // Adicionado para indicar que é server-side
  };

  // Adicionar URL de origem, se fornecida
  if (eventSourceUrl) {
    event.event_source_url = eventSourceUrl;
    logger.debug(`URL de origem adicionada: ${eventSourceUrl}`);
  }

  logger.info('Dados do evento formatados com sucesso');
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
    logger.info(`Iniciando envio de evento para pixel ${pixelId}`);
    
    const formattedEvent = formatEventData(eventData);
    const apiUrl = `${config.facebook.apiUrl}/${pixelId}/events`;

    const payload = {
      data: [formattedEvent],
      access_token: accessToken,
      test_event_code: testCode || undefined,
    };

    logger.info(`Enviando evento ${eventData.eventName} para o Facebook`);
    logger.debug(`Payload: ${JSON.stringify(payload, null, 2)}`);
    
    const response = await axios.post(apiUrl, payload);
    
    logger.info('Evento enviado com sucesso para o Facebook');
    logger.debug(`Resposta: ${JSON.stringify(response.data, null, 2)}`);
    
    return response.data;
  } catch (error) {
    logger.error(`Erro ao enviar evento para o Facebook: ${error.message}`);
    if (error.response) {
      logger.error(`Resposta de erro: ${JSON.stringify(error.response.data)}`);
      logger.error(`Status: ${error.response.status}`);
      logger.error(`Headers: ${JSON.stringify(error.response.headers)}`);
    }
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Falha ao enviar evento para o Facebook');
  }
};

module.exports = {
  formatEventData,
  sendEvent,
}; 