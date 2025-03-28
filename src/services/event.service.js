const httpStatus = require('http-status');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const config = require('../config/config');
const facebookService = require('./facebook.service');
const geoipService = require('./geoip.service');

const prisma = new PrismaClient();

/**
 * Obtém a configuração do pixel baseado na hierarquia de prioridade
 * @param {Object} eventData - Dados do evento
 * @param {string} domain - Domínio da requisição
 * @returns {Promise<Object>} Configuração do pixel
 */
const getPixelConfig = async (eventData, domain) => {
  logger.info('Iniciando busca de configuração do pixel');
  logger.debug('Dados recebidos:', { eventData, domain });

  // 1. Usar pixel_id do payload se fornecido
  if (eventData.pixel_id) {
    logger.info(`Usando pixel_id do payload: ${eventData.pixel_id}`);
    return {
      pixelId: eventData.pixel_id,
      accessToken: config.facebook.accessToken,
      testCode: config.facebook.testCode
    };
  }

  // 2. Buscar configuração específica do domínio
  if (domain) {
    try {
      const pixelConfig = await prisma.pixelConfig.findFirst({
        where: {
          OR: [
            { domain },
            { pixelId: domain }
          ],
          isActive: true
        }
      });

      if (pixelConfig) {
        logger.info(`Usando configuração específica para domínio: ${domain}`);
        return {
          pixelId: pixelConfig.pixelId,
          accessToken: pixelConfig.accessToken,
          testCode: pixelConfig.testCode
        };
      }
    } catch (error) {
      logger.error('Erro ao buscar configuração do pixel:', error);
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Erro ao buscar configuração do pixel'
      );
    }
  }

  // 3. Usar configuração padrão
  if (config.facebook.pixelId) {
    logger.info('Usando configuração padrão do pixel');
    return {
      pixelId: config.facebook.pixelId,
      accessToken: config.facebook.accessToken,
      testCode: config.facebook.testCode
    };
  }

  // Se nenhuma configuração foi encontrada
  throw new ApiError(
    httpStatus.BAD_REQUEST,
    'Nenhuma configuração de pixel encontrada para o domínio fornecido'
  );
};

/**
 * Validar dados do evento
 * @param {Object} eventData
 * @throws {ApiError}
 */
const validateEventData = (eventData) => {
  logger.info('Iniciando validação dos dados do evento');
  
  // Garantir que eventData não seja null ou undefined
  if (!eventData) {
    logger.error('Dados do evento ausentes ou inválidos');
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Dados do evento ausentes ou inválidos',
      'EventDataInvalidError',
      true
    );
  }
  
  // Log de debug para entender o conteúdo exato
  logger.debug('EventData para validação:', JSON.stringify(eventData, null, 2));
  
  // Validar campos obrigatórios
  const requiredFields = ['event_name'];
  const missingFields = requiredFields.filter(field => !eventData[field] || eventData[field] === '');
  
  if (missingFields.length > 0) {
    logger.error(`Campos obrigatórios ausentes: ${missingFields.join(', ')}`);
    logger.debug(`Valor do event_name recebido: ${JSON.stringify(eventData.event_name)}`);
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Campos obrigatórios ausentes: ${missingFields.join(', ')}`,
      'MissingFieldsError',
      true
    );
  }

  // Validar pixel_id se fornecido
  if (eventData.pixel_id) {
    if (!/^\d+$/.test(eventData.pixel_id)) {
      logger.error(`Pixel ID inválido: ${eventData.pixel_id}`);
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Pixel ID deve conter apenas números',
        'InvalidPixelIdError',
        true
      );
    }
    logger.info(`Pixel ID válido fornecido: ${eventData.pixel_id}`);
  } else {
    logger.info('Pixel ID não fornecido, será buscado na configuração');
  }

  // Validar eventTime
  if (eventData.event_time) {
    const eventTime = parseInt(eventData.event_time);
    if (isNaN(eventTime) || eventTime < 0) {
      logger.error(`Event time inválido: ${eventData.event_time}`);
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Event time deve ser um timestamp válido',
        'InvalidEventTimeError',
        true
      );
    }
  }

  // Validar URL
  if (eventData.event_source_url) {
    try {
      new URL(eventData.event_source_url);
    } catch (error) {
      logger.error(`URL inválida: ${eventData.event_source_url}`);
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'URL de origem inválida',
        'InvalidUrlError',
        true
      );
    }
  }

  // Validar dados de valor
  if (eventData.custom_data?.value !== undefined) {
    const value = parseFloat(eventData.custom_data.value);
    if (isNaN(value) || value < 0) {
      logger.error(`Valor inválido: ${eventData.custom_data.value}`);
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Valor deve ser um número positivo',
        'InvalidValueError',
        true
      );
    }
  }

  logger.info('Validação dos dados do evento concluída com sucesso');
};

/**
 * Criar um novo evento
 * @param {Object} eventData
 * @returns {Promise<Event>}
 */
const createEvent = async (eventData, clientIp) => {
  const startTime = Date.now();
  try {
    logger.info('Iniciando processamento de novo evento');
    logger.info('Dados recebidos:', JSON.stringify(eventData, null, 2));

    // Validar dados do evento
    validateEventData(eventData);

    // Extrair IP do cliente
    const ip = clientIp || eventData.userData?.ip;
    logger.info(`IP do cliente extraído: ${ip}`);

    // Enriquecer dados com GeoIP
    if (ip) {
      logger.info('Iniciando enriquecimento com dados GeoIP');
      const geoData = await geoipService.getLocation(ip);
      if (geoData) {
        logger.info(`Dados GeoIP obtidos para IP ${ip}:`);
        logger.info(JSON.stringify(geoData, null, 2));
        eventData.userData = {
          ...eventData.userData,
          ...geoData,
        };
        logger.info('Dados de geolocalização enriquecidos com sucesso');
      } else {
        logger.warn(`Nenhum dado de geolocalização encontrado para IP ${ip}`);
      }
    }

    // Garantir que o pixelId esteja definido
    if (!eventData.pixelId) {
      eventData.pixelId = config.facebook.pixelId;
      if (!eventData.pixelId) {
        logger.error('Pixel ID não configurado');
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          'Pixel ID não configurado',
          true
        );
      }
      logger.info(`Usando Pixel ID padrão: ${eventData.pixelId}`);
    }

    // Criar evento no banco de dados
    logger.info('Iniciando criação do evento no banco de dados');
    const event = await prisma.event.create({
      data: {
        id: uuidv4(),
        pixelId: eventData.pixelId,
        eventName: eventData.eventName,
        eventTime: eventData.eventTime || Math.floor(Date.now() / 1000),
        sourceUrl: eventData.sourceUrl,
        userData: eventData.userData || {},
        customData: eventData.customData || {},
        value: eventData.value,
        currency: eventData.currency,
      },
    });
    logger.info(`Evento criado no banco de dados com ID: ${event.id}`);

    // Enviar evento para o Facebook
    if (eventData.pixelId) {
      logger.info(`Iniciando envio de evento para pixel ${eventData.pixelId}`);
      await facebookService.sendEvent(eventData);
      logger.info('Evento enviado com sucesso para o Facebook');
    }

    const processingTime = Date.now() - startTime;
    logger.info(`Processamento do evento concluído em ${processingTime}ms`);

    return event;
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(`Erro ao processar evento após ${processingTime}ms:`, error);
    
    // Se for um ApiError, propaga o erro
    if (error instanceof ApiError) {
      throw error;
    }

    // Caso contrário, cria um novo ApiError
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Erro ao processar evento',
      true,
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
  const startTime = Date.now();
  try {
    logger.info('Iniciando processamento de novo evento');
    logger.debug('Dados recebidos:', JSON.stringify(eventData, null, 2));

    // Garantir que eventData é um objeto
    if (!eventData || typeof eventData !== 'object') {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Dados do evento inválidos',
        'InvalidEventDataError',
        true
      );
    }

    // Validar dados do evento
    validateEventData(eventData);

    // Obter configuração do pixel
    const pixelConfig = await getPixelConfig(eventData, domainOrPixelId);
    logger.info('Configuração do pixel obtida:', JSON.stringify(pixelConfig, null, 2));

    // Extrair campos principais com fallback para valores padrão
    const eventName = eventData.event_name;
    const eventTime = eventData.event_time || Math.floor(Date.now() / 1000);
    
    // Preparar dados do evento com valores padrão onde necessário
    const eventToSave = {
      pixelId: pixelConfig.pixelId,
      eventName: eventName,
      eventTime: eventTime,
      userData: {
        email: eventData.user_data?.email || '',
        phone: eventData.user_data?.phone || '',
        firstName: eventData.user_data?.first_name || '',
        lastName: eventData.user_data?.last_name || '',
        externalId: eventData.user_data?.external_id || '',
        ip: eventData.user_data?.ip_address || '',
        userAgent: eventData.user_data?.client_user_agent || eventData.client_user_agent || '',
        city: eventData.user_data?.city || '',
        state: eventData.user_data?.state || '',
        country: eventData.user_data?.country || '',
        zipCode: eventData.user_data?.zip_code || '',
        fbp: eventData.user_data?.fbp || eventData.fbp || '',
      },
      customData: eventData.custom_data || {},
      status: 'pending', // Inicialmente pendente
    };

    // Adicionar campos de rastreamento
    eventToSave.sourceUrl = eventData.event_source_url || '';
    eventToSave.referrer = eventData.referrer || '';
    eventToSave.domain = domainOrPixelId || '';
    eventToSave.language = eventData.language || '';
    eventToSave.appName = eventData.app || '';

    logger.debug('Evento preparado para salvar:', JSON.stringify(eventToSave, null, 2));

    // Salvar evento no banco de dados
    const savedEvent = await prisma.event.create({
      data: {
        id: uuidv4(),
        pixelId: eventToSave.pixelId,
        eventName: eventToSave.eventName,
        eventTime: eventToSave.eventTime,
        userData: eventToSave.userData,
        customData: eventToSave.customData,
        status: eventToSave.status,
        sourceUrl: eventToSave.sourceUrl,
        referrer: eventToSave.referrer,
        domain: eventToSave.domain,
        language: eventToSave.language,
        appName: eventToSave.appName,
      },
    });

    logger.info(`Evento salvo com sucesso, ID: ${savedEvent.id}`);

    try {
      // Enviar evento para o Facebook
      const fbDataToSend = {
        eventName: savedEvent.eventName,
        eventTime: savedEvent.eventTime,
        userData: savedEvent.userData,
        customData: savedEvent.customData,
        eventId: savedEvent.id,
        eventSourceUrl: eventToSave.sourceUrl,
        fbp: eventToSave.userData.fbp,
      };

      logger.debug('Dados a serem enviados para o Facebook:', JSON.stringify(fbDataToSend, null, 2));

      const fbResponse = await facebookService.sendEvent(
        pixelConfig.pixelId,
        pixelConfig.accessToken,
        fbDataToSend,
        pixelConfig.testCode
      );

      // Atualizar evento com resposta do Facebook
      const updatedEvent = await prisma.event.update({
        where: { id: savedEvent.id },
        data: {
          status: 'sent',
          responseData: fbResponse,
          fbEventId: fbResponse.events_received?.[0]?.id || null
        }
      });

      const processingTime = Date.now() - startTime;
      logger.info(`Processamento do evento concluído em ${processingTime}ms`);

      return updatedEvent;
    } catch (error) {
      // Em caso de falha, atualizar o evento com o erro
      logger.error(`Erro ao enviar evento para o Facebook: ${error.message}`);
      
      const updatedEvent = await prisma.event.update({
        where: { id: savedEvent.id },
        data: {
          status: 'failed',
          errorMessage: error.message || 'Erro desconhecido ao enviar para Facebook'
        }
      });

      // Propagar o erro como ApiError
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        `Erro ao enviar evento para o Facebook: ${error.message}`,
        'FacebookSendError',
        true,
        error.stack
      );
    }
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(`Erro ao processar evento após ${processingTime}ms:`, error);
    
    // Se for um ApiError, propaga o erro
    if (error instanceof ApiError) {
      throw error;
    }

    // Caso contrário, cria um novo ApiError
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Erro ao processar evento',
      error.message || 'Erro desconhecido',
      true,
      error.stack
    );
  }
};

module.exports = {
  createEvent,
  getEventById,
  queryEvents,
  processEvent,
}; 