const Joi = require('joi');

/**
 * Validação de eventos para API
 */
const eventValidation = {
  createEvent: {
    body: Joi.object()
      .keys({
        // Campo "app" adicionado como obrigatório
        app: Joi.string().required().messages({
          'any.required': 'O nome da aplicação é obrigatório',
          'string.empty': 'O nome da aplicação não pode estar vazio',
          'string.base': 'O nome da aplicação deve ser uma string',
        }),

        event_name: Joi.string()
          .required()
          .messages({
            'any.required': 'O nome do evento é obrigatório',
            'string.empty': 'O nome do evento não pode estar vazio',
            'string.base': 'O nome do evento deve ser uma string',
          }),

        // Campos adicionais presentes na requisição
        language: Joi.string().allow('').messages({
          'string.base': 'O idioma deve ser uma string',
        }),
        
        referrer: Joi.string().allow('').messages({
          'string.base': 'O referrer deve ser uma string',
        }),
        
        external_id: Joi.string().guid({ version: 'uuidv4' }).messages({
          'string.guid': 'O external_id deve ser um UUID v4 válido',
          'string.base': 'O external_id deve ser uma string',
        }),
        
        fbp: Joi.alternatives().try(
          Joi.string().allow(''),
          Joi.allow(null)
        ).messages({
          'alternatives.match': 'O fbp deve ser uma string ou nulo',
          'string.base': 'O fbp deve ser uma string ou nulo'
        }),
        
        client_user_agent: Joi.string().messages({
          'string.base': 'O client_user_agent deve ser uma string',
        }),
        
        content_type: Joi.string().messages({
          'string.base': 'O content_type deve ser uma string',
        }),
        
        content_name: Joi.string().messages({
          'string.base': 'O content_name deve ser uma string',
        }),

        // Adicionando os campos que estavam causando erro
        content_ids: Joi.array().items(Joi.string()).messages({
          'array.base': 'Os IDs de conteúdo devem ser um array',
        }),
        
        value: Joi.number().min(0).messages({
          'number.base': 'O valor deve ser um número',
          'number.min': 'O valor deve ser um número positivo',
        }),
        
        currency: Joi.string().allow('').messages({
          'string.base': 'A moeda deve ser uma string',
        }),

        // Outros campos ajustados
        pixel_id: Joi.string().pattern(/^\d+$/).messages({
          'string.pattern.base': 'O ID do pixel deve conter apenas números',
          'string.base': 'O ID do pixel deve ser uma string',
        }),
        
        event_time: Joi.number().required().messages({
          'any.required': 'O timestamp do evento é obrigatório',
          'number.base': 'O timestamp do evento deve ser um número',
        }),
        
        domain: Joi.string().messages({
          'string.empty': 'O domínio não pode estar vazio',
          'string.base': 'O domínio deve ser uma string',
        }),
        
        user_data: Joi.object().keys({
          // Campos adicionais do user_data
          client_user_agent: Joi.string().messages({
            'string.base': 'O client_user_agent deve ser uma string',
          }),
          
          external_id: Joi.string().guid({ version: 'uuidv4' }).messages({
            'string.guid': 'O external_id deve ser um UUID v4 válido',
            'string.base': 'O external_id deve ser uma string',
          }),
          
          fbp: Joi.alternatives().try(
            Joi.string().allow(''),
            Joi.allow(null)
          ).messages({
            'alternatives.match': 'O fbp deve ser uma string ou nulo',
            'string.base': 'O fbp deve ser uma string ou nulo'
          }),
          
          // Outros campos de user_data
          email: Joi.string().email().allow('').messages({
            'string.email': 'O email deve ser um endereço válido',
            'string.base': 'O email deve ser uma string',
          }),
          
          phone: Joi.string().allow('').messages({
            'string.base': 'O telefone deve ser uma string',
          }),
          
          first_name: Joi.string().allow('').messages({
            'string.base': 'O primeiro nome deve ser uma string',
          }),
          
          last_name: Joi.string().allow('').messages({
            'string.base': 'O sobrenome deve ser uma string',
          }),
          
          ip_address: Joi.string().allow('').messages({
            'string.base': 'O endereço IP deve ser uma string',
          }),
        }),
        
        custom_data: Joi.object().keys({
          currency: Joi.string().allow('').messages({
            'string.base': 'A moeda deve ser uma string',
          }),
          
          value: Joi.number().min(0).messages({
            'number.base': 'O valor deve ser um número',
            'number.min': 'O valor deve ser um número positivo',
          }),
          
          content_ids: Joi.array().items(Joi.string()).messages({
            'array.base': 'Os IDs de conteúdo devem ser um array',
          }),
          
          content_category: Joi.string().allow('').messages({
            'string.base': 'A categoria de conteúdo deve ser uma string',
          }),
          
          content_name: Joi.string().allow('').messages({
            'string.base': 'O nome do conteúdo deve ser uma string',
          }),
          
          content_type: Joi.string().allow('').messages({
            'string.base': 'O tipo de conteúdo deve ser uma string',
          }),
        }),
      })
      .options({ allowUnknown: false, stripUnknown: false }), // Bloqueia campos não mapeados
  },
  
  getEvents: {
    query: Joi.object().keys({
      pixelId: Joi.string().messages({
        'string.base': 'O ID do pixel deve ser uma string',
      }),
      
      eventName: Joi.string().messages({
        'string.base': 'O nome do evento deve ser uma string',
      }),
      
      status: Joi.string().valid('pending', 'sent', 'failed').messages({
        'any.only': 'O status deve ser pending, sent ou failed',
        'string.base': 'O status deve ser uma string',
      }),
      
      sortBy: Joi.string().messages({
        'string.base': 'O campo de ordenação deve ser uma string',
      }),
      
      limit: Joi.number().integer().min(1).messages({
        'number.base': 'O limite deve ser um número',
        'number.integer': 'O limite deve ser um número inteiro',
        'number.min': 'O limite deve ser maior ou igual a 1',
      }),
      
      page: Joi.number().integer().min(1).messages({
        'number.base': 'A página deve ser um número',
        'number.integer': 'A página deve ser um número inteiro',
        'number.min': 'A página deve ser maior ou igual a 1',
      }),
    }),
  },
  
  getEvent: {
    params: Joi.object().keys({
      eventId: Joi.string().required().messages({
        'any.required': 'O ID do evento é obrigatório',
        'string.empty': 'O ID do evento não pode estar vazio',
        'string.base': 'O ID do evento deve ser uma string',
      }),
    }),
  },
};

module.exports = eventValidation;
