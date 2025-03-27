const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const { Event } = require('../models');
const { PixelConfig } = require('../models');
const facebookService = require('./facebook.service');
const config = require('../config/config');

/**
 * Cria um registro de evento
 * @param {Object} eventBody
 * @returns {Promise<Event>}
 */
const createEvent = async (eventBody) => {
  const event = await Event.create(eventBody);
  return event;
};

/**
 * Obtém evento por ID
 * @param {ObjectId} id
 * @returns {Promise<Event>}
 */
const getEventById = async (id) => {
  return Event.findById(id);
};

/**
 * Consulta eventos
 * @param {Object} filter - Filtro do Mongoose
 * @param {Object} options - Opções de consulta
 * @param {string} [options.sortBy] - Classificação (ex: "field1:desc,field2:asc")
 * @param {number} [options.limit] - Máximo de resultados por página
 * @param {number} [options.page] - Página atual
 * @returns {Promise<QueryResult>}
 */
const queryEvents = async (filter, options) => {
  const events = await Event.paginate(filter, options);
  return events;
};

/**
 * Processa e envia evento para o Facebook
 * @param {Object} eventData - Dados do evento
 * @param {string} domainOrPixelId - Domínio ou ID do pixel
 * @returns {Promise<Event>}
 */
const processEvent = async (eventData, domainOrPixelId) => {
  // Configuração global padrão
  let pixelId = config.facebook.pixelId;
  let accessToken = config.facebook.accessToken;
  let testCode = config.facebook.testCode;

  // Verificar se existe uma configuração específica
  try {
    const pixelConfig = await PixelConfig.findOne({
      $or: [{ domain: domainOrPixelId }, { pixelId: domainOrPixelId }],
      isActive: true,
    });

    if (pixelConfig) {
      pixelId = pixelConfig.pixelId;
      accessToken = pixelConfig.accessToken;
      testCode = pixelConfig.testCode;
      logger.info(`Usando configuração específica para: ${domainOrPixelId}`);
    } else {
      logger.info(`Configuração não encontrada para ${domainOrPixelId}, usando configuração global`);
    }
  } catch (error) {
    logger.error(`Erro ao buscar configuração: ${error.message}`);
  }

  // Verificar se temos ID do pixel e token de acesso
  if (!pixelId || !accessToken) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Configuração de pixel não encontrada');
  }

  // Preparar dados do evento
  const eventToSave = {
    pixelId,
    eventName: eventData.event_name,
    eventTime: eventData.event_time || Math.floor(Date.now() / 1000),
    userData: {
      email: eventData.user_data?.email,
      phone: eventData.user_data?.phone,
      firstName: eventData.user_data?.first_name,
      lastName: eventData.user_data?.last_name,
      externalId: eventData.user_data?.external_id,
      ip: eventData.user_data?.ip_address,
      userAgent: eventData.user_data?.user_agent,
      city: eventData.user_data?.city,
      state: eventData.user_data?.state,
      country: eventData.user_data?.country,
      zipCode: eventData.user_data?.zip_code,
    },
    customData: eventData.custom_data || {},
  };

  // Salvar evento no banco de dados
  const savedEvent = await createEvent(eventToSave);

  try {
    // Enviar evento para o Facebook
    const fbDataToSend = {
      eventName: savedEvent.eventName,
      eventTime: savedEvent.eventTime,
      userData: savedEvent.userData,
      customData: savedEvent.customData,
      eventId: savedEvent.id,
    };

    const fbResponse = await facebookService.sendEvent(pixelId, accessToken, fbDataToSend, testCode);

    // Atualizar evento com resposta do Facebook
    savedEvent.status = 'sent';
    savedEvent.responseData = fbResponse;
    savedEvent.fbEventId = fbResponse.events_received?.[0]?.id;
    await savedEvent.save();

    return savedEvent;
  } catch (error) {
    // Em caso de falha, atualizar o evento com o erro
    savedEvent.status = 'failed';
    savedEvent.errorMessage = error.message || 'Erro desconhecido';
    await savedEvent.save();

    throw error;
  }
};

module.exports = {
  createEvent,
  getEventById,
  queryEvents,
  processEvent,
}; 