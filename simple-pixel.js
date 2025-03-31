// Código de pixel simples
(function() {
  function sendPixel(data) {
    const pixel = new Image();
    pixel.src = '/api/v1/event/pixel?' + new URLSearchParams(data).toString();
  }

  // Adiciona o listener para o evento de pixel
  document.addEventListener('pixel', function(event) {
    const pixelData = event.detail;
    sendPixel(pixelData);
  });
})(); 