const validator = require('validator');
const httpStatus = require('http-status');
const logger = require('../config/logger');
const ApiError = require('./ApiError');

const validateEmail = (email) => {
  if (!email) return null;
  return validator.isEmail(email) ? email.toLowerCase() : null;
};

const validatePhone = (phone) => {
  if (!phone) return null;
  // Remove todos os caracteres não numéricos
  const cleaned = phone.replace(/\D/g, '');
  // Adiciona código do país se não presente
  return cleaned.length >= 10 ? (cleaned.length === 10 ? `55${cleaned}` : cleaned) : null;
};

const validateCoordinates = (lat, lng) => {
  if (!lat || !lng) return null;
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);
  return !isNaN(latitude) && !isNaN(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
    ? { latitude, longitude }
    : null;
};

const validateUrl = (url) => {
  if (!url) return null;
  
  try {
    new URL(url);
    return url;
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'URL inválida');
  }
};

const validateTimestamp = (timestamp) => {
  if (!timestamp) return Math.floor(Date.now() / 1000);
  
  const parsed = parseInt(timestamp, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Timestamp inválido');
  }
  
  return parsed;
};

const validateCurrency = (value) => {
  if (value === undefined || value === null) return null;
  
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Valor inválido');
  }
  
  return parsed;
};

const normalizeLocation = (location) => {
  if (!location) return null;
  return {
    city: location.city ? location.city.trim().toLowerCase() : null,
    state: location.state ? location.state.trim().toUpperCase() : null,
    country: location.country ? location.country.trim().toUpperCase() : null,
    coordinates: location.latitude && location.longitude ? validateCoordinates(location.latitude, location.longitude) : null
  };
};

const validateUserData = (userData) => {
  if (!userData) return null;
  
  const validated = {};
  
  // Validar email se presente
  if (userData.email) {
    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userData.email)) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Email inválido');
      }
      validated.email = userData.email;
    } catch (error) {
      logger.warn('Email inválido:', error);
    }
  }
  
  // Validar telefone se presente
  if (userData.phone) {
    try {
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      if (!phoneRegex.test(userData.phone)) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Telefone inválido');
      }
      validated.phone = userData.phone;
    } catch (error) {
      logger.warn('Telefone inválido:', error);
    }
  }
  
  // Validar nome se presente
  if (userData.first_name) {
    try {
      if (typeof userData.first_name !== 'string' || userData.first_name.trim().length === 0) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Nome inválido');
      }
      validated.first_name = userData.first_name.trim();
    } catch (error) {
      logger.warn('Nome inválido:', error);
    }
  }
  
  // Validar sobrenome se presente
  if (userData.last_name) {
    try {
      if (typeof userData.last_name !== 'string' || userData.last_name.trim().length === 0) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Sobrenome inválido');
      }
      validated.last_name = userData.last_name.trim();
    } catch (error) {
      logger.warn('Sobrenome inválido:', error);
    }
  }
  
  // Validar IP se presente
  if (userData.ip) {
    try {
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipRegex.test(userData.ip)) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'IP inválido');
      }
      validated.ip = userData.ip;
    } catch (error) {
      logger.warn('IP inválido:', error);
    }
  }
  
  return Object.keys(validated).length > 0 ? validated : null;
};

const validateEventData = (eventData) => {
  if (!eventData) {
    logger.error('Dados do evento não fornecidos');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Dados do evento são obrigatórios');
  }

  logger.info('Iniciando validação dos dados do evento');
  logger.info('Dados recebidos:', JSON.stringify(eventData, null, 2));

  // Validar campos obrigatórios
  const requiredFields = ['event_name', 'pixel_id'];
  const missingFields = requiredFields.filter((field) => {
    const value = eventData[field];
    const isMissing = value === undefined || value === null || value === '';
    if (isMissing) {
      logger.error(`Campo ${field} ausente ou vazio`);
    }
    return isMissing;
  });

  if (missingFields.length > 0) {
    const errorMessage = `Campos obrigatórios ausentes: ${missingFields.join(', ')}`;
    logger.error(errorMessage);
    throw new ApiError(httpStatus.BAD_REQUEST, errorMessage);
  }

  // Validar formato do pixel_id
  if (!/^\d+$/.test(eventData.pixel_id)) {
    const errorMessage = 'pixel_id deve conter apenas números';
    logger.error(errorMessage);
    throw new ApiError(httpStatus.BAD_REQUEST, errorMessage);
  }

  // Validar formato do event_name
  if (typeof eventData.event_name !== 'string' || eventData.event_name.trim().length === 0) {
    const errorMessage = 'event_name deve ser uma string não vazia';
    logger.error(errorMessage);
    throw new ApiError(httpStatus.BAD_REQUEST, errorMessage);
  }

  const validated = {
    event_name: eventData.event_name.trim(),
    pixel_id: eventData.pixel_id,
    event_time: validateTimestamp(eventData.event_time),
    event_source_url: validateUrl(eventData.event_source_url),
    value: validateCurrency(eventData.value),
    currency: eventData.currency || 'BRL',
    content_name: eventData.content_name || null,
    content_category: eventData.content_category || null,
    content_ids: Array.isArray(eventData.content_ids) ? eventData.content_ids : null,
    content_type: eventData.content_type || null,
    user_data: validateUserData(eventData.user_data),
    custom_data: eventData.custom_data || null
  };

  // Remove campos nulos
  return Object.fromEntries(Object.entries(validated).filter(([_, v]) => v !== null));
};

module.exports = {
  validateEmail,
  validatePhone,
  validateCoordinates,
  validateUrl,
  validateTimestamp,
  validateCurrency,
  normalizeLocation,
  validateUserData,
  validateEventData
};
