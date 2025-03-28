const httpStatus = require('http-status');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const config = require('../config/config');
const facebookService = require('./facebook.service');

const prisma = new PrismaClient();

/**
 * Criar novo evento
 * @param {Object} eventData
 * @returns {Promise<Object>}
 */
const createEvent = async (eventData, clientIp) => {
  try {
    // Adicionar pixelId aos dados do evento
    const eventWithPixel = {
      ...eventData,
      pixelId: config.facebook.pixelId, // Adiciona o pixelId do config
      eventName: eventData.event_name, // Garante que o eventName seja passado corretamente
      eventTime: eventData.event_time || Math.floor(Date.now() / 1000) // Garante que o eventTime seja passado corretamente
    };

    // Criar evento no banco de dados
    const event = await prisma.event.create({
      data: eventWithPixel
    });

    // Enviar evento para o Facebook
    await facebookService.sendEvent(
      config.facebook.pixelId,
      config.facebook.accessToken,
      {
        eventName: event.eventName,
        eventTime: event.eventTime,
        eventSourceUrl: event.eventSourceUrl,
        userData: {
          ...event.userData,
          ip: clientIp
        },
        customData: event.customData,
        value: event.value,
        currency: event.currency
      },
      config.facebook.testEventCode
    );

    return event;
  } catch (error) {
    logger.error('Erro ao processar evento:', error);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Erro ao processar evento',
      false,
      error.stack
    );
  }
};

/**
 * Obtém evento por ID
 * @param {ObjectId} id
 * @returns {Promise<Event>}
 */
const getEventById = async (id) => {
  return prisma.event.findUnique({
    where: { id }
  });
};

/**
 * Consulta eventos
 * @param {Object} filter - Filtro para consulta
 * @param {Object} options - Opções de consulta
 * @param {string} [options.sortBy] - Classificação (ex: "field1:desc,field2:asc")
 * @param {number} [options.limit] - Máximo de resultados por página
 * @param {number} [options.page] - Página atual
 * @returns {Promise<QueryResult>}
 */
const queryEvents = async (filter, options) => {
  const page = options.page ?? 1;
  const limit = options.limit ?? 10;
  const skip = (page - 1) * limit;

  let orderBy = {};
  if (options.sortBy) {
    const parts = options.sortBy.split(':');
    orderBy[parts[0]] = parts[1] === 'desc' ? 'desc' : 'asc';
  }

  const [items, totalItems] = await Promise.all([
    prisma.event.findMany({
      where: filter,
      skip,
      take: limit,
      orderBy
    }),
    prisma.event.count({ where: filter })
  ]);

  return {
    results: items,
    page,
    limit,
    totalPages: Math.ceil(totalItems / limit),
    totalResults: totalItems
  };
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
    const pixelConfig = await prisma.pixelConfig.findFirst({
      where: {
        OR: [
          { domain: domainOrPixelId },
          { pixelId: domainOrPixelId }
        ],
        isActive: true
      }
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
      eventSourceUrl: eventData.event_source_url,
    };

    const fbResponse = await facebookService.sendEvent(pixelId, accessToken, fbDataToSend, testCode);

    // Atualizar evento com resposta do Facebook
    const updatedEvent = await prisma.event.update({
      where: { id: savedEvent.id },
      data: {
        status: 'sent',
        responseData: fbResponse,
        fbEventId: fbResponse.events_received?.[0]?.id
      }
    });

    return updatedEvent;
  } catch (error) {
    // Em caso de falha, atualizar o evento com o erro
    const updatedEvent = await prisma.event.update({
      where: { id: savedEvent.id },
      data: {
        status: 'failed',
        errorMessage: error.message || 'Erro desconhecido'
      }
    });

    throw error;
  }
};

module.exports = {
  createEvent,
  getEventById,
  queryEvents,
  processEvent,
}; 