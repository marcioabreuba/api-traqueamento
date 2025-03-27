const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createEvent = {
  body: Joi.object().keys({
    event_name: Joi.string()
      .required()
      .valid(
        'Purchase',
        'Lead',
        'CompleteRegistration',
        'Subscribe',
        'AddToCart',
        'InitiateCheckout',
        'ViewContent',
        'Search',
        'Contact',
        'AddPaymentInfo',
        'AddToWishlist',
        'CustomizeProduct',
        'Donate',
        'FindLocation'
      ),
    event_time: Joi.number().integer(),
    domain: Joi.string(),
    user_data: Joi.object().keys({
      email: Joi.string().email(),
      phone: Joi.string(),
      first_name: Joi.string(),
      last_name: Joi.string(),
      external_id: Joi.string(),
      ip_address: Joi.string(),
      user_agent: Joi.string(),
      city: Joi.string(),
      state: Joi.string(),
      country: Joi.string(),
      zip_code: Joi.string(),
    }),
    custom_data: Joi.object().unknown(true),
  }),
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
  createEvent,
  getEvents,
  getEvent,
}; 