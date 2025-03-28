const logger = require('../config/logger');
const eventService = require('./event.service');

/**
 * Processa webhook da Yampi
 * @param {Object} webhookData - Dados do webhook da Yampi
 * @returns {Promise<void>}
 */
const processWebhook = async (webhookData) => {
  try {
    logger.info('Processando webhook da Yampi');
    logger.debug(`Dados do webhook: ${JSON.stringify(webhookData)}`);

    // Extrair dados relevantes do webhook
    const {
      event,
      order,
      customer,
      store,
      payment_method,
      payment_status,
      total_value
    } = webhookData;

    // Mapear eventos da Yampi para eventos do Facebook
    const eventMapping = {
      // Eventos de Checkout
      'checkout.started': 'InitiateCheckout',
      'checkout.form_started': 'StartCheckout',
      'checkout.form_completed': 'RegisterDone',
      'checkout.shipping_added': 'AddShippingInfo',
      'checkout.payment_added': 'AddPaymentInfo',
      'checkout.coupon_added': 'AddCoupon',
      'order.payment_failed': 'Refused - credit_card',
      'order.paid': 'Purchase',
      'order.paid_pix': 'Purchase - paid_pix',
      'order.paid_credit_card': 'Purchase - credit_card',
      'order.paid_billet': 'Purchase - billet',
      'order.paid_high_ticket': 'Purchase - high_ticket'
    };

    const fbEventName = eventMapping[event];
    if (!fbEventName) {
      logger.warn(`Evento não mapeado: ${event}`);
      return;
    }

    // Preparar dados do usuário
    const userData = {
      email: customer?.email,
      phone: customer?.phone,
      firstName: customer?.first_name,
      lastName: customer?.last_name,
      externalId: customer?.id?.toString(),
      ip: order?.ip_address,
      city: order?.shipping_address?.city,
      state: order?.shipping_address?.state,
      country: order?.shipping_address?.country,
      zipCode: order?.shipping_address?.zip_code
    };

    // Preparar dados customizados
    const customData = {
      content_type: 'product',
      content_ids: order?.items?.map(item => item.product_id),
      value: order?.total,
      currency: order?.currency || 'BRL',
      num_items: order?.items?.length,
      order_id: order?.id,
      store_id: store?.id,
      payment_method: payment_method,
      payment_status: payment_status
    };

    // Criar evento para o Facebook
    const eventData = {
      event_name: fbEventName,
      event_time: Math.floor(Date.now() / 1000),
      user_data: userData,
      custom_data: customData
    };

    // Processar e enviar evento
    await eventService.processEvent(eventData, store?.domain);

    logger.info(`Evento ${fbEventName} processado com sucesso`);
  } catch (error) {
    logger.error(`Erro ao processar webhook da Yampi: ${error.message}`);
    throw error;
  }
};

module.exports = {
  processWebhook
}; 