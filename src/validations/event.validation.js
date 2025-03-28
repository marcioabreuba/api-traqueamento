const Joi = require('joi');
const { objectId } = require('./custom.validation');

const eventValidation = {
  body: Joi.object().keys({
    event_name: Joi.string().valid(
      // Eventos de Visualização
      'PageView',
      'ViewContent',
      'ViewItemList',
      'ViewCategory',
      'ViewSearchResults',
      'ViewCart',
      'ViewHome',
      
      // Eventos de Checkout
      'InitiateCheckout',
      'StartCheckout',
      'RegisterDone',
      'AddShippingInfo',
      'AddPaymentInfo',
      'AddCoupon',
      'Purchase - credit_card',
      'Purchase - boleto',
      'Purchase - pix',
      'Purchase - transfer',
      
      // Eventos de Interação
      'AddToCart',
      'Search',
      'Contact',
      'AddToWishlist',
      'CustomizeProduct',
      'Donate',
      'FindLocation',
      
      // Eventos de Conversão
      'Lead',
      'CompleteRegistration',
      'Subscribe'
    ).required(),
    event_time: Joi.number().required(),
    domain: Joi.string().required(),
    user_data: Joi.object().keys({
      em: Joi.array().items(Joi.string().email()),
      ph: Joi.array().items(Joi.string()),
      external_id: Joi.string(),
      client_ip_address: Joi.string(),
      client_user_agent: Joi.string(),
      fbc: Joi.string(),
      fbp: Joi.string(),
      subscription_id: Joi.string(),
      fb_login_id: Joi.string()
    }),
    custom_data: Joi.object().keys({
      content_name: Joi.string(),
      content_category: Joi.string(),
      content_ids: Joi.array().items(Joi.string()),
      content_type: Joi.string(),
      value: Joi.number(),
      currency: Joi.string(),
      num_items: Joi.number(),
      search_string: Joi.string(),
      status: Joi.boolean(),
      description: Joi.string()
    })
  })
};

const getEvents = {
  query: Joi.object().keys({
    pixelId: Joi.string(),
    eventName: Joi.string(),
    status: Joi.string().valid('pending', 'sent', 'failed'),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const getEvent = {
  params: Joi.object().keys({
    eventId: Joi.string().custom(objectId),
  }),
};

module.exports = {
  eventValidation,
  getEvents,
  getEvent,
}; 