const httpStatus = require('http-status');
const { PrismaClient } = require('@prisma/client');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

const prisma = new PrismaClient();

/**
 * Buscar pixel por ID
 * @param {string} id - ID do pixel
 * @returns {Promise<Object>} Pixel encontrado
 */
const getPixelById = async (id) => {
  try {
    const pixel = await prisma.pixel.findUnique({
      where: { id }
    });

    if (!pixel) {
      logger.warn(`Pixel não encontrado: ${id}`);
      return null;
    }

    return pixel;
  } catch (error) {
    logger.error(`Erro ao buscar pixel ${id}:`, error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Erro ao buscar pixel');
  }
};

/**
 * Buscar pixel por domínio
 * @param {string} domain - Domínio do pixel
 * @returns {Promise<Object>} Pixel encontrado
 */
const getPixelByDomain = async (domain) => {
  try {
    const pixel = await prisma.pixel.findFirst({
      where: { domain }
    });

    if (!pixel) {
      logger.warn(`Pixel não encontrado para domínio: ${domain}`);
      return null;
    }

    return pixel;
  } catch (error) {
    logger.error(`Erro ao buscar pixel para domínio ${domain}:`, error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Erro ao buscar pixel');
  }
};

/**
 * Validar configuração do pixel
 * @param {Object} pixel - Configuração do pixel
 * @returns {boolean} Se a configuração é válida
 */
const validatePixelConfig = (pixel) => {
  if (!pixel) return false;
  if (!pixel.id) return false;
  if (!pixel.domain) return false;
  if (!pixel.access_token) return false;
  return true;
};

module.exports = {
  getPixelById,
  getPixelByDomain,
  validatePixelConfig
}; 