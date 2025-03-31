// Código de rastreamento do checkout
(function() {
  function sendCheckoutEvent(data) {
    const pixel = new Image();
    pixel.src = '/api/v1/event/checkout?' + new URLSearchParams(data).toString();
  }

  // Adiciona o listener para o evento de checkout
  document.addEventListener('checkout', function(event) {
    const checkoutData = event.detail;
    sendCheckoutEvent(checkoutData);
  });
})(); 