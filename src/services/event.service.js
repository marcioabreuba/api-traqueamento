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
  const missingFields = requiredFields.filter(field => {
    const value = eventData[field];
    // Verificar se o campo está ausente ou vazio
    return value === undefined || value === null || value === '';
  });

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
    const eventTime = parseInt(eventData.event_time, 10);
    if (Number.isNaN(eventTime) || eventTime < 0) {
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
      // Use a URL construída sem manter referência para evitar "side effects"
      const url = new URL(eventData.event_source_url);
      if (!url) {
        throw new Error('URL inválida');
      }
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
  if (eventData.custom_data && eventData.custom_data.value !== undefined) {
    const value = parseFloat(eventData.custom_data.value);
    if (Number.isNaN(value) || value < 0) {
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
    const ip = clientIp || (eventData.userData && eventData.userData.ip);
    logger.info(`IP do cliente extraído: ${ip}`);

    // Enriquecer dados com GeoIP
    if (ip) {
      logger.info('Iniciando enriquecimento com dados GeoIP');
      const geoData = await geoipService.getLocation(ip);
      if (geoData) {
        logger.info(`Dados GeoIP obtidos para IP ${ip}:`);
        logger.info(JSON.stringify(geoData, null, 2));

        // Criar uma cópia completa do eventData em vez de modificar diretamente
        const enrichedEventData = {
          ...eventData,
          userData: {
            ...(eventData.userData || {}),
            ...geoData
          }
        };

        // Substituir eventData pela versão enriquecida
        return processEventWithGeoData(enrichedEventData, eventData.pixelId);
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

    // Caso contrário, cria um novo ApiError com statusCode explícito
    const fallbackStatusCode = 500; // Definir explicitamente
    throw new ApiError(
      fallbackStatusCode,
      'Erro ao processar evento',
      error.message || 'Erro desconhecido',
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
  const page = options.page !== undefined && options.page !== null ? options.page : 1;
  const limit = options.limit !== undefined && options.limit !== null ? options.limit : 10;
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
 * Processa e envia evento para o Facebook com dados de geolocalização
 * Esta função interna é usada após o enriquecimento com GeoIP
 * @param {Object} eventData - Dados do evento já enriquecidos
 * @param {string} domainOrPixelId - Domínio ou ID do pixel
 * @returns {Promise<Event>}
 */
const processEventWithGeoData = async (eventData, domainOrPixelId) => {
  const startTime = Date.now();
  // Criar variável para armazenar o evento salvo
  let savedEvent = null;

  try {
    logger.info('Continuando processamento com dados GeoIP');

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
        email: eventData.user_data && eventData.user_data.email || '',
        phone: eventData.user_data && eventData.user_data.phone || '',
        firstName: eventData.user_data && eventData.user_data.first_name || '',
        lastName: eventData.user_data && eventData.user_data.last_name || '',
        externalId: eventData.user_data && eventData.user_data.external_id || '',
        ip: eventData.user_data && eventData.user_data.ip_address || '',
        userAgent: (eventData.user_data && eventData.user_data.client_user_agent) || eventData.client_user_agent || '',
        city: eventData.user_data && eventData.user_data.city || '',
        state: eventData.user_data && eventData.user_data.state || '',
        country: eventData.user_data && eventData.user_data.country || '',
        zipCode: eventData.user_data && eventData.user_data.zip_code || '',
        fbp: ((eventData.user_data && eventData.user_data.fbp !== null) ? eventData.user_data.fbp : '') ||
          ((eventData.fbp !== null) ? eventData.fbp : '') || '',
        sourceUrl: eventData.event_source_url || '',
        referrer: eventData.referrer || '',
        domain: domainOrPixelId || '',
        language: eventData.language || '',
        appName: eventData.app || '',
      },
      customData: eventData.custom_data || {},
      status: 'pending', // Inicialmente pendente
    };

    logger.debug('Evento preparado para salvar:', JSON.stringify(eventToSave, null, 2));

    // Salvar evento no banco de dados
    savedEvent = await prisma.event.create({
      data: {
        id: uuidv4(),
        pixelId: eventToSave.pixelId,
        eventName: eventToSave.eventName,
        eventTime: eventToSave.eventTime,
        userData: eventToSave.userData,
        customData: eventToSave.customData,
        status: eventToSave.status,
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
        eventSourceUrl: eventToSave.userData.sourceUrl,
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
      try {
        // Verificar e preparar os dados antes de atualizar
        let fbEventId = null;
        let responseDataToSave = {};

        // Verificar se a resposta do Facebook é válida
        if (fbResponse) {
          responseDataToSave = typeof fbResponse === 'object' ? fbResponse : { response: fbResponse };

          // Tratar o ID do evento extraído da resposta
          if (fbResponse.events_received &&
            Array.isArray(fbResponse.events_received) &&
            fbResponse.events_received.length > 0 &&
            fbResponse.events_received[0]) {
            fbEventId = fbResponse.events_received[0].id || null;
          }
        }

        logger.info(`Atualizando evento ${savedEvent.id} com status 'sent'`);

        // Atualizar o evento no banco de dados
        console.log('fbEventId', fbEventId);
        const updatedEvent = await prisma.event.update({
          where: { id: savedEvent.id },
          data: {
            status: 'sent',
            responseData: responseDataToSave,
            fbEventId: fbEventId,
            updatedAt: new Date() // Garantir que o timestamp de atualização é correto
          }
        });
        

        const processingTime = Date.now() - startTime;
        logger.info(`Processamento do evento concluído em ${processingTime}ms`);

        // Retornar o evento atualizado
        return updatedEvent;
      } catch (updateError) {
        logger.error(`Erro ao atualizar evento no banco: ${updateError.message}`);
        logger.error(`Stack trace: ${updateError.stack}`);

        // Mesmo com falha na atualização, consideramos que o evento foi enviado com sucesso
        // então retornamos o evento original para não propagar erro ao cliente
        logger.info('Retornando evento original pois o envio para o Facebook foi bem sucedido');

        // Atualizar apenas o objeto em memória para manter a consistência na resposta
        savedEvent.status = 'sent_not_updated';
        savedEvent.responseData = fbResponse || {};

        return savedEvent;
      }
    } catch (sendError) {
      // Em caso de falha no envio, atualizar o evento com o erro
      logger.error(`Erro ao enviar evento para o Facebook: ${sendError.message}`);

      // Garantir que sempre temos uma mensagem de erro
      const errorMessage = sendError.message || 'Erro desconhecido ao enviar para Facebook';

      try {
        // Atualizar o status do evento para 'failed'
        logger.info(`Atualizando evento ${savedEvent.id} com status 'failed'`);

        await prisma.event.update({
          where: { id: savedEvent.id },
          data: {
            status: 'failed',
            errorMessage: errorMessage,
            updatedAt: new Date()
          }
        });

        // Depois de atualizar com sucesso, propagar o erro com um status code apropriado
        // para que o cliente seja informado corretamente
        let statusCode = httpStatus.BAD_GATEWAY; // 502 como padrão para falhas de comunicação externa

        // Se o erro original tiver um código de status válido, usá-lo
        if (sendError.statusCode &&
          Number.isInteger(sendError.statusCode) &&
          sendError.statusCode >= 100 &&
          sendError.statusCode <= 599) {
          statusCode = sendError.statusCode;
        } else if (sendError.response && sendError.response.status) {
          // Para erros do Axios
          statusCode = sendError.response.status;
        }

        logger.error(`Propagando erro com status code ${statusCode}`);

        // Criar um novo ApiError para garantir consistência
        throw new ApiError(
          statusCode,
          `Erro ao enviar evento para o Facebook: ${errorMessage}`,
          'FacebookSendError',
          true,
          sendError.stack
        );
      } catch (updateError) {
        // Se falhar ao atualizar o evento no banco
        logger.error(`Erro ao atualizar status de falha no banco: ${updateError.message}`);
        logger.error(`Stack trace do erro de atualização: ${updateError.stack}`);

        // Criar um novo ApiError combinando os dois erros para fornecer mais contexto
        const combinedMessage = `Falha ao enviar para Facebook: ${errorMessage}. Erro adicional ao atualizar status: ${updateError.message}`;
        logger.error(combinedMessage);

        // Definir um status code válido
        let statusCode = httpStatus.INTERNAL_SERVER_ERROR;

        if (sendError instanceof ApiError &&
          sendError.statusCode &&
          Number.isInteger(sendError.statusCode) &&
          sendError.statusCode >= 100 &&
          sendError.statusCode <= 599) {
          statusCode = sendError.statusCode;
        }

        throw new ApiError(
          statusCode,
          combinedMessage,
          'FacebookSendAndUpdateError',
          true,
          sendError.stack
        );
      }
    }
  } catch (originalError) {
    const processingTime = Date.now() - startTime;

    // Garantir que temos sempre um objeto de erro válido
    let error = originalError;

    if (!error) {
      error = new Error('Erro desconhecido durante processamento do evento');
    }

    if (typeof error === 'string') {
      error = new Error(error);
    }

    const errorMessage = error.message || 'Erro desconhecido';
    logger.error(`Erro ao processar evento após ${processingTime}ms: ${errorMessage}`);
    logger.error(`Stack trace: ${error.stack || 'Sem stack trace disponível'}`);

    try {
      // Se tivermos o savedEvent, atualizar seu status para 'error'
      if (savedEvent) {
        logger.info(`Atualizando evento ${savedEvent.id} com status 'error'`);

        await prisma.event.update({
          where: { id: savedEvent.id },
          data: {
            status: 'error',
            errorMessage: errorMessage,
            updatedAt: new Date()
          }
        });

        logger.info(`Status do evento ${savedEvent.id} atualizado para 'error'`);
      }
    } catch (updateError) {
      logger.error(`Falha ao atualizar status do evento para 'error': ${updateError.message}`);
    }

    // Tentar obter um código de status válido
    let statusCode = httpStatus.INTERNAL_SERVER_ERROR; // 500 como padrão

    if (error instanceof ApiError && error.statusCode) {
      // Verificar se o statusCode é válido
      if (Number.isInteger(error.statusCode) && error.statusCode >= 100 && error.statusCode <= 599) {
        statusCode = error.statusCode;
      } else {
        logger.warn(`Status code inválido ${error.statusCode}, usando 500 como fallback`);
      }
    } else if (error.response && error.response.status) {
      // Para erros do Axios
      if (Number.isInteger(error.response.status) && error.response.status >= 100 && error.response.status <= 599) {
        statusCode = error.response.status;
      }
    }

    logger.error(`Erro será propagado com status code ${statusCode}`);

    // Se for um ApiError, atualizar o statusCode e propagar
    if (error instanceof ApiError) {
      // Criar um novo ApiError em vez de modificar o original
      throw new ApiError(
        statusCode,
        error.message,
        error.isOperational ? error.name : 'EventProcessingError',
        error.isOperational,
        error.stack
      );
    } else {
      // Caso não seja um ApiError, criar um novo com status code válido
      throw new ApiError(
        statusCode,
        `Erro ao processar evento: ${errorMessage}`,
        'EventProcessingError',
        true,
        error.stack
      );
    }
  }
};

/**
 * Processa e envia evento para o Facebook
 * @param {Object} eventDataInput - Dados do evento
 * @param {string} domainOrPixelId - Domínio ou ID do pixel
 * @returns {Promise<Event>}
 */
const processEvent = async (eventDataInput, domainOrPixelId) => {
  // eslint-disable-next-line no-use-before-define
  const processData = processEventWithGeoData; // Referência para evitar no-use-before-define

  const startTime = Date.now();
  try {
    logger.info('Iniciando processamento de novo evento');
    logger.debug('Dados recebidos:', JSON.stringify(eventDataInput, null, 2));

    // Garantir que eventData é um objeto
    if (!eventDataInput || typeof eventDataInput !== 'object') {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Dados do evento inválidos',
        'InvalidEventDataError',
        true
      );
    }

    // Trabalhar com uma cópia do objeto para evitar mutação
    const eventData = { ...eventDataInput };

    // Validar dados do evento
    validateEventData(eventData);

    // Extrair IP do cliente
    const ip = (eventData.userData && eventData.userData.ip) ||
      (eventData.user_data && eventData.user_data.ip_address);
    logger.info(`IP do cliente extraído: ${ip || 'não disponível'}`);

    // Enriquecer dados com GeoIP
    if (ip) {
      logger.info('Iniciando enriquecimento com dados GeoIP');
      const geoData = await geoipService.getLocation(ip);
      if (geoData) {
        logger.info(`Dados GeoIP obtidos para IP ${ip}:`);
        logger.info(JSON.stringify(geoData, null, 2));

        // Criar uma cópia completa do eventData com os dados de geolocalização
        const enrichedEventData = {
          ...eventData,
          userData: {
            ...(eventData.userData || {}),
            ...geoData
          }
        };

        logger.info('Dados de geolocalização enriquecidos com sucesso');

        // Continuar processamento com dados enriquecidos
        return processData(enrichedEventData, domainOrPixelId);
      } else {
        logger.warn(`Nenhum dado de geolocalização encontrado para IP ${ip}`);
      }
    }

    // Se não houver enriquecimento com GeoIP, continuar o processamento normal
    return processData(eventData, domainOrPixelId);
  } catch (originalError) {
    const processingTime = Date.now() - startTime;

    // Garantir que temos sempre um objeto de erro válido
    let error = originalError;

    if (!error) {
      error = new Error('Erro desconhecido durante processamento do evento');
    }

    if (typeof error === 'string') {
      error = new Error(error);
    }

    const errorMessage = error.message || 'Erro desconhecido';
    logger.error(`Erro inicial ao processar evento após ${processingTime}ms: ${errorMessage}`);
    logger.error(`Stack trace inicial: ${error.stack || 'Sem stack trace disponível'}`);

    // Tentar obter um código de status válido
    let statusCode = httpStatus.INTERNAL_SERVER_ERROR; // 500 como padrão

    if (error instanceof ApiError && error.statusCode) {
      // Verificar se o statusCode é válido
      if (Number.isInteger(error.statusCode) && error.statusCode >= 100 && error.statusCode <= 599) {
        statusCode = error.statusCode;
      } else {
        logger.warn(`Status code inválido ${error.statusCode}, usando 500 como fallback`);
      }
    } else if (error.response && error.response.status) {
      // Para erros do Axios
      if (Number.isInteger(error.response.status) && error.response.status >= 100 && error.response.status <= 599) {
        statusCode = error.response.status;
      }
    }

    logger.error(`Erro inicial será propagado com status code ${statusCode}`);

    // Caso seja um ApiError, criar uma cópia com statusCode correto
    if (error instanceof ApiError) {
      throw new ApiError(
        statusCode,
        error.message,
        error.name || 'EventProcessingError',
        error.isOperational,
        error.stack
      );
    } else {
      // Caso não seja um ApiError, criar um novo com status code válido
      throw new ApiError(
        statusCode,
        `Erro ao processar evento: ${errorMessage}`,
        'EventProcessingError',
        true,
        error.stack
      );
    }
  }
};

module.exports = {
  createEvent,
  getEventById,
  queryEvents,
  processEvent,
};