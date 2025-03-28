const axios = require('axios');
const httpStatus = require('http-status');
const { v4: uuidv4 } = require('uuid');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const config = require('../config/config');

/**
 * Log formatado dos dados do evento no estilo do Pixel Helper
 */
const logEventDetails = (pixelId, eventData, testEventCode) => {
  logger.info('\n📊 === FACEBOOK PIXEL EVENT DETAILS === 📊');
  logger.info('----------------------------------------');
  logger.info(`🎯 Pixel ID: ${pixelId}`);
  logger.info(`📝 Event Name: ${eventData.eventName}`);
  logger.info(`🕒 Event Time: ${new Date(eventData.eventTime * 1000).toISOString()}`);
  
  if (eventData.eventSourceUrl) {
    logger.info(`🔗 Source URL: ${eventData.eventSourceUrl}`);
  }

  if (eventData.userData) {
    logger.info('\n👤 USER DATA:');
    logger.info('------------');
    if (eventData.userData.email) logger.info(`📧 Email: ${eventData.userData.email}`);
    if (eventData.userData.phone) logger.info(`📱 Phone: ${eventData.userData.phone}`);
    if (eventData.userData.firstName) logger.info(`👤 First Name: ${eventData.userData.firstName}`);
    if (eventData.userData.lastName) logger.info(`👤 Last Name: ${eventData.userData.lastName}`);
    if (eventData.userData.city) logger.info(`🏙️ City: ${eventData.userData.city}`);
    if (eventData.userData.state) logger.info(`🗺️ State: ${eventData.userData.state}`);
    if (eventData.userData.country) logger.info(`🌎 Country: ${eventData.userData.country}`);
    if (eventData.userData.ip) logger.info(`🌐 IP: ${eventData.userData.ip}`);
    if (eventData.userData.userAgent) logger.info(`🌐 User Agent: ${eventData.userData.userAgent}`);
  }

  if (eventData.customData) {
    logger.info('\n🔧 CUSTOM DATA:');
    logger.info('-------------');
    Object.entries(eventData.customData).forEach(([key, value]) => {
      logger.info(`📎 ${key}: ${value}`);
    });
  }

  if (eventData.value || eventData.currency) {
    logger.info('\n💰 VALUE DATA:');
    logger.info('------------');
    if (eventData.value) logger.info(`💵 Value: ${eventData.value}`);
    if (eventData.currency) logger.info(`💱 Currency: ${eventData.currency}`);
  }

  logger.info('\n⚙️ CONFIGURATION:');
  logger.info('---------------');
  logger.info(`🔑 Test Event Code: ${testEventCode || 'Not configured'}`);
  logger.info(`📡 API Version: v18.0`);
  logger.info('----------------------------------------\n');
};

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
    pixelId
  } = data;

  // Log detalhado do evento
  logEventDetails(pixelId, data, null);

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
    pixelId // Adicionando pixelId ao evento
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
 * @param {string} testEventCode - Código de teste opcional
 * @returns {Promise<Object>}
 */
const sendEvent = async (pixelId, accessToken, eventData, testEventCode = null) => {
  try {
    logger.info(`Iniciando envio de evento para pixel ${pixelId}`);
    
    // Log detalhado do evento
    logEventDetails(pixelId, eventData, testEventCode);

    // Formatar dados do evento
    const formattedEvent = formatEventData(eventData);
    logger.info(`Formatando evento: ${eventData.eventName} (ID: ${formattedEvent.event_id})`);
    logger.info('Dados do evento formatados com sucesso');

    // Preparar payload para a API do Facebook
    const payload = {
      data: [formattedEvent],
      test_event_code: testEventCode,
      access_token: accessToken
    };

    // Enviar evento para o Facebook
    logger.info(`Enviando evento ${eventData.eventName} para o Facebook`);
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${pixelId}/events`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    logger.info('Evento enviado com sucesso para o Facebook');
    return response.data;
  } catch (error) {
    logger.error('Erro ao enviar evento para o Facebook:', error.message);
    if (error.response) {
      logger.error('Resposta de erro:', error.response.data);
      logger.error('Status:', error.response.status);
      logger.error('Headers:', error.response.headers);
    }
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Falha ao enviar evento para o Facebook',
      false,
      error.stack
    );
  }
};

module.exports = {
  formatEventData,
  sendEvent,
}; 