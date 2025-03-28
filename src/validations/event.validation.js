const Joi = require('joi');
const { objectId } = require('./custom.validation');

const eventValidation = {
  createEvent: {
    body: Joi.object().keys({
      // Campo "app" adicionado como obrigatório
      app: Joi.string().required().messages({
        'any.required': 'O nome da aplicação é obrigatório',
        'string.empty': 'O nome da aplicação não pode estar vazio'
      }),
      
      event_name: Joi.string().valid(
        // ... (lista de eventos permanece igual)
      ).required().messages({
        'any.required': 'O nome do evento é obrigatório',
        'string.empty': 'O nome do evento não pode estar vazio',
        'any.only': 'O nome do evento deve ser um dos valores permitidos'
      }),

      // Campos adicionais presentes na sua requisição
      language: Joi.string(),
      referrer: Joi.string(),
      external_id: Joi.string().guid({ version: 'uuidv4' }),
      fbp: Joi.string(),
      client_user_agent: Joi.string(),
      content_type: Joi.string(),
      content_name: Joi.string(),

      // Outros campos ajustados
      pixel_id: Joi.string().pattern(/^\d+$/).messages({
        'string.pattern.base': 'O ID do pixel deve conter apenas números'
      }),
      event_time: Joi.number().required().messages({
        'any.required': 'O timestamp do evento é obrigatório',
        'number.base': 'O timestamp do evento deve ser um número'
      }),
      domain: Joi.string().messages({
        'string.empty': 'O domínio não pode estar vazio'
      }),
      user_data: Joi.object().keys({
        // Campos adicionais do user_data
        client_user_agent: Joi.string(),
        external_id: Joi.string().guid({ version: 'uuidv4' }),
        fbp: Joi.string(),
        // ... (outros campos permanecem)
      }),
      custom_data: Joi.object().keys({
        // ... (campos permanecem iguais)
      })
    }).options({ allowUnknown: false }) // Bloqueia campos não mapeados
  },
  // ... (getEvents e getEvent permanecem iguais)
};

module.exports = eventValidation;