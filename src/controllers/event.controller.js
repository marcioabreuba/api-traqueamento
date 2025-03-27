const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { eventService, geoipService } = require('../services');
const ApiError = require('../utils/ApiError');
const pick = require('../utils/pick');
const logger = require('../config/logger');

/**
 * Criar e enviar um evento
 */
const createEvent = catchAsync(async (req, res) => {
  // Extrair e enriquecer dados com informações de IP, se ausentes
  if (!req.body.user_data || !req.body.user_data.ip_address) {
    if (!req.body.user_data) {
      req.body.user_data = {};
    }
    
    // Extrair IP do cliente
    const clientIp = geoipService.extractClientIp(req);
    req.body.user_data.ip_address = clientIp;
    
    // Tentar enriquecer com informações de geolocalização
    try {
      const geoData = geoipService.lookupIp(clientIp);
      if (geoData) {
        if (!req.body.user_data.city && geoData.city) {
          req.body.user_data.city = geoData.city;
        }
        if (!req.body.user_data.state && geoData.region) {
          req.body.user_data.state = geoData.region;
        }
        if (!req.body.user_data.country && geoData.country) {
          req.body.user_data.country = geoData.country;
        }
      }
    } catch (error) {
      logger.warn(`Erro ao obter dados de geolocalização: ${error.message}`);
    }
  }

  // Extrair user-agent se não fornecido
  if (!req.body.user_data.user_agent && req.headers['user-agent']) {
    req.body.user_data.user_agent = req.headers['user-agent'];
  }

  // Definir timestamp atual se não fornecido
  if (!req.body.event_time) {
    req.body.event_time = Math.floor(Date.now() / 1000);
  }

  // Processar e enviar evento
  const domain = req.params.domain || req.query.domain || req.body.domain;
  const event = await eventService.processEvent(req.body, domain);
  res.status(httpStatus.CREATED).send(event);
});

/**
 * Obter evento por ID
 */
const getEvent = catchAsync(async (req, res) => {
  const event = await eventService.getEventById(req.params.eventId);
  if (!event) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Evento não encontrado');
  }
  res.send(event);
});

/**
 * Listar eventos
 */
const getEvents = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['pixelId', 'eventName', 'status']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await eventService.queryEvents(filter, options);
  res.send(result);
});

module.exports = {
  createEvent,
  getEvent,
  getEvents,
}; 