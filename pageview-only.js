// Código de rastreamento de pageview
(function() {
  function sendPageView() {
    const pixel = new Image();
    pixel.src = '/api/v1/event/pageview?' + new URLSearchParams({
      url: window.location.href,
      title: document.title,
      referrer: document.referrer
    }).toString();
  }

  // Envia o pageview quando a página carrega
  window.addEventListener('load', sendPageView);
})(); 