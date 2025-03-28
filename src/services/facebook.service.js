const axios = require('axios');
const httpStatus = require('http-status');
const { v4: uuidv4 } = require('uuid');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const config = require('../config/config');

// Configuração do retry
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 segundo entre tentativas

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
    if (eventData.userData.fbp) logger.info(`🔍 FBP: ${eventData.userData.fbp}`);
    if (eventData.userData.external_id) logger.info(`🆔 External ID: ${eventData.userData.external_id}`);
  }

  if (eventData.customData) {
    logger.info('\n🔧 CUSTOM DATA:');
    logger.info('-------------');
    Object.entries(eventData.customData).forEach(([key, value]) => {
      logger.info(`📎 ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
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
  logger.info(`📡 API Version: ${config.facebook.apiUrl.match(/v\d+\.\d+/) || 'Unknown'}`);
  logger.info('----------------------------------------\n');
};

/**
 * Formato de dados para a Conversions API
 * @param {Object} data
 * @returns {Object} payload formatado para o Facebook
 */
const formatEventData = (data) => {
  logger.debug('Iniciando formatação dos dados do evento');

  const { eventName, eventTime, userData = {}, customData = {}, eventSourceUrl, eventId = uuidv4() } = data;

  // Processar userData conforme especificação oficial do Facebook
  // https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters
  const formattedUserData = {
    client_ip_address: userData.ip || null,
    client_user_agent: userData.userAgent || null,
  };

  // Adicionar campos condicionalmente se existirem e não forem vazios
  if (userData.email && userData.email.trim() !== '') {
    formattedUserData.em = [userData.email];
    logger.debug('Email adicionado aos dados do usuário');
  }
  if (userData.phone && userData.phone.trim() !== '') {
    formattedUserData.ph = [userData.phone];
    logger.debug('Telefone adicionado aos dados do usuário');
  }
  if (userData.firstName && userData.firstName.trim() !== '') {
    formattedUserData.fn = [userData.firstName];
    logger.debug('Nome adicionado aos dados do usuário');
  }
  if (userData.lastName && userData.lastName.trim() !== '') {
    formattedUserData.ln = [userData.lastName];
    logger.debug('Sobrenome adicionado aos dados do usuário');
  }
  if (userData.externalId && userData.externalId.trim() !== '') {
    formattedUserData.external_id = [userData.externalId];
    logger.debug('ID externo adicionado aos dados do usuário');
  }
  if (userData.city && userData.city.trim() !== '') {
    formattedUserData.ct = [userData.city];
    logger.debug(`Cidade adicionada aos dados do usuário: ${userData.city}`);
  }
  if (userData.state && userData.state.trim() !== '') {
    formattedUserData.st = [userData.state];
    logger.debug(`Estado adicionado aos dados do usuário: ${userData.state}`);
  }
  if (userData.zipCode && userData.zipCode.trim() !== '') {
    formattedUserData.zp = [userData.zipCode];
    logger.debug(`CEP adicionado aos dados do usuário: ${userData.zipCode}`);
  }
  if (userData.country && userData.country.trim() !== '') {
    formattedUserData.country = [userData.country];
    logger.debug(`País adicionado aos dados do usuário: ${userData.country}`);
  }
  // Adicionar o FBP se existir
  if (userData.fbp && userData.fbp.trim() !== '') {
    formattedUserData.fbp = userData.fbp;
    logger.debug(`FBP adicionado aos dados do usuário: ${userData.fbp}`);
  }

  // Processar customData para garantir que contém apenas os campos esperados pela API
  const cleanedCustomData = {};

  // Adicionar apenas campos válidos e não vazios ao customData
  if (customData) {
    Object.entries(customData).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        cleanedCustomData[key] = value;
      }
    });
  }

  // Garantir que currency e value são incluídos no customData se existirem no eventData
  if (data.currency) {
    cleanedCustomData.currency = data.currency;
  }

  if (data.value) {
    cleanedCustomData.value = data.value;
  }

  // Construir evento conforme especificação do Facebook Conversions API
  // https://developers.facebook.com/docs/marketing-api/conversions-api/parameters
  const event = {
    event_name: eventName,
    event_time: eventTime,
    user_data: formattedUserData,
    custom_data: cleanedCustomData,
    event_id: eventId,
    action_source: 'website', // Identifica a origem do evento como website
  };

  // Adicionar URL de origem, se fornecida
  if (eventSourceUrl) {
    event.event_source_url = eventSourceUrl;
    logger.debug(`URL de origem adicionada: ${eventSourceUrl}`);
  }

  logger.info(`Evento formatado: ${eventName} (ID: ${eventId})`);
  logger.debug('Evento formatado com sucesso:', JSON.stringify(event, null, 2));

  return event;
};

/**
 * Enviar evento para a Conversions API do Facebook com retry
 * @param {string} pixelId - ID do pixel
 * @param {string} accessToken - Access Token do Facebook
 * @param {Object} eventData - Dados do evento
 * @param {string} testCode - Código do teste
 * @returns {Promise<Object>} - Resposta do Facebook
 */
const sendEvent = async (pixelId, accessToken, eventData, testCode) => {
  // Usar uma cópia local do eventData para evitar modificar o parâmetro original
  const eventDataCopy = { ...eventData };

  // Transformar loop for em um loop diferente para evitar await no loop
  let attempt = 1;

  const tryEvent = async () => {
    try {
      logger.info(`Tentativa ${attempt} de ${MAX_RETRIES} de envio do evento ${eventDataCopy.eventName}`);

      // Validar dados obrigatórios
      if (!pixelId) {
        logger.error('Pixel ID não fornecido');
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          'Pixel ID é obrigatório para envio ao Facebook',
          'MissingPixelIdError',
          true,
        );
      }

      if (!accessToken) {
        logger.error('Access Token não fornecido');
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          'Access Token é obrigatório para envio ao Facebook',
          'MissingAccessTokenError',
          true,
        );
      }

      if (!eventDataCopy.eventName) {
        logger.error('Nome do evento não fornecido');
        throw new ApiError(httpStatus.BAD_REQUEST, 'Nome do evento é obrigatório', 'MissingEventNameError', true);
      }

      // Definir eventTime se não existir, sem modificar o parâmetro original
      const finalEventData = {
        ...eventDataCopy,
        pixelId, // Adicionar pixelId para formatação correta
        eventTime: eventDataCopy.eventTime || Math.floor(Date.now() / 1000),
      };

      logger.info(`Iniciando envio de evento para pixel ${pixelId}`);

      // Log detalhado do evento antes da formatação
      logEventDetails(pixelId, finalEventData, testCode);

      // Formatar dados do evento
      const formattedEvent = formatEventData(finalEventData);

      // Preparar payload conforme formato oficial do Facebook
      // https://developers.facebook.com/docs/marketing-api/conversions-api/using-the-api
      const payload = {
        data: [formattedEvent],
        access_token: accessToken,
      };

      // Adicionar test_event_code apenas se estiver definido
      if (testCode && testCode.trim() !== '') {
        payload.test_event_code = testCode;
        logger.info(`Código de teste incluso: ${testCode}`);
      }

      // Log do payload completo para depuração (ocultando o access_token para segurança)
      const logPayload = { ...payload, access_token: '****' };
      logger.debug('Payload enviado para a API do Facebook:', JSON.stringify(logPayload, null, 2));

      // Endereço e formato correto da API conforme documentação
      const apiUrl = `${config.facebook.apiUrl}/${pixelId}/events`;
      logger.debug(`Enviando para URL: ${apiUrl}`);

      // Enviar evento para o Facebook
      const response = await axios.post(apiUrl, payload);

      // Verificar resposta
      if (response && response.status) {
        logger.debug(`Status da resposta Facebook: ${response.status}`);

        if (response.data) {
          logger.debug('Resposta da API Facebook:', JSON.stringify(response.data, null, 2));

          if (response.data.events_received) {
            logger.info(
              `Evento enviado com sucesso para o Facebook (ID: ${formattedEvent.event_id}). Eventos recebidos: ${response.data.events_received}`,
            );
            return response.data;
          }
          // Mesmo se não houver events_received, considerar sucesso se status 200
          if (response.status >= 200 && response.status < 300) {
            logger.info(`Evento enviado para o Facebook (ID: ${formattedEvent.event_id}). Status: ${response.status}`);
            return response.data;
          }
        }

        // Status OK mas sem dados esperados na resposta
        if (response.status >= 200 && response.status < 300) {
          logger.info(`Evento enviado com status ${response.status}, mas formato da resposta inesperado`);
          return { success: true, status: response.status };
        }

        throw new Error(`Resposta inválida do Facebook: status ${response.status}`);
      }

      throw new Error('Resposta indefinida do Facebook');
    } catch (error) {
      // Adicionar detalhes mais específicos sobre o erro
      logger.error(`Tentativa ${attempt} falhou ao enviar evento para o Facebook:`, {
        error: error.message,
        stack: error.stack,
        attempt,
        eventName: eventDataCopy.eventName,
        pixelId,
      });

      // Se for a última tentativa, lançar erro
      if (attempt >= MAX_RETRIES) {
        logger.error(`Todas as ${MAX_RETRIES} tentativas falharam para o evento ${eventDataCopy.eventName}`);

        let errorMessage = 'Falha ao enviar evento para o Facebook após múltiplas tentativas';
        let statusCode = httpStatus.BAD_GATEWAY;

        // Extrair detalhes do erro mais úteis
        if (error.response) {
          // Erro com resposta do servidor (erro HTTP)
          statusCode = error.response.status || httpStatus.BAD_GATEWAY;
          errorMessage = `Erro ${statusCode} do Facebook: ${JSON.stringify(error.response.data || {})}`;
          logger.error('Detalhes da resposta de erro:', {
            status: statusCode,
            data: error.response.data,
            headers: error.response.headers,
          });
        } else if (error.request) {
          // Erro sem resposta (timeout, DNS, etc)
          errorMessage = `Erro de conexão com o Facebook: ${error.message}`;
          logger.error('Detalhes do erro de requisição:', {
            message: error.message,
          });
        } else {
          // Erro de configuração ou outro
          errorMessage = `Erro ao configurar requisição para o Facebook: ${error.message}`;
          logger.error('Detalhes do erro de configuração:', {
            message: error.message,
            stack: error.stack,
          });
        }

        throw new ApiError(statusCode, errorMessage, 'FacebookApiError', true, error.stack);
      }

      // Incrementar tentativa e usar espera segura
      attempt += 1;

      // Esperar antes da próxima tentativa com backoff exponencial
      const delay = RETRY_DELAY * 2 ** (attempt - 1);
      logger.info(`Aguardando ${delay}ms antes da próxima tentativa`);

      await new Promise((resolve) => {
        setTimeout(resolve, delay);
      });

      // Chamar recursivamente para a próxima tentativa
      return tryEvent();
    }
  };

  // Iniciar as tentativas
  return tryEvent();
};

module.exports = {
  formatEventData,
  sendEvent,
  logEventDetails,
};
