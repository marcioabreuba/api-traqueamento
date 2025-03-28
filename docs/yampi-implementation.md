# Implementação do Facebook Pixel na Yampi

## 1. Adicionar o Script Base

No arquivo `header.liquid` do seu tema Yampi, adicione o seguinte código logo após a tag `<head>`:

```liquid
<!-- Facebook Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');

fbq('init', '1163339595278098');
fbq('track', 'PageView');
</script>
<noscript>
  <img height="1" width="1" style="display:none"
    src="https://www.facebook.com/tr?id=1163339595278098&ev=PageView&noscript=1"/>
</noscript>
<!-- End Facebook Pixel Code -->
```

## 2. Adicionar Atributos Data

### Página de Produto
```liquid
<div class="product" data-product-id="{{ product.id }}">
  <h1 data-product-name="{{ product.name }}">{{ product.name }}</h1>
  <span data-product-price="{{ product.price }}">{{ product.price }}</span>
</div>
```

### Carrinho
```liquid
<div class="cart" data-cart-total="{{ cart.total }}">
  {% for item in cart.items %}
    <div class="cart-item" data-cart-item data-product-id="{{ item.product.id }}">
      <!-- conteúdo do item -->
    </div>
  {% endfor %}
</div>
```

### Checkout
```liquid
<form data-checkout-form>
  <!-- formulário de checkout -->
</form>

<form data-shipping-form>
  <!-- formulário de entrega -->
</form>

<form data-payment-form>
  <!-- formulário de pagamento -->
</form>

<form data-coupon-form>
  <!-- formulário de cupom -->
</form>
```

### Página de Confirmação
```liquid
<div class="order" data-order-total="{{ order.total }}">
  {% for item in order.items %}
    <div class="order-item" data-order-item data-product-id="{{ item.product.id }}">
      <!-- conteúdo do item -->
    </div>
  {% endfor %}
  <div data-payment-method="{{ order.payment_method }}">
    {{ order.payment_method }}
  </div>
</div>
```

### Busca
```liquid
<form data-search-form>
  <input type="search" name="q">
  {% for product in search.results %}
    <div class="search-result" data-search-result data-product-id="{{ product.id }}">
      <!-- resultado da busca -->
    </div>
  {% endfor %}
</form>
```

## 3. Adicionar Evento AddToCart

No arquivo que lida com a adição ao carrinho (geralmente `cart.js` ou similar), adicione:

```javascript
document.addEventListener('addToCart', function(e) {
  const { productId, productName, price, quantity } = e.detail;
  
  fbq('track', 'AddToCart', {
    content_type: 'product',
    content_ids: [productId],
    content_name: productName,
    value: parseFloat(price.replace(/[^\d,]/g, '').replace(',', '.')),
    currency: 'BRL',
    num_items: quantity
  });
});
```

## 4. Verificação

Para verificar se o pixel está funcionando corretamente:

1. Instale a extensão "Facebook Pixel Helper" no Chrome
2. Acesse sua loja
3. Verifique se o pixel está sendo carregado
4. Teste os eventos navegando pela loja
5. Verifique no Facebook Events Manager se os eventos estão sendo registrados

## 5. Solução de Problemas

Se o pixel não estiver funcionando:

1. Verifique se o ID do pixel está correto
2. Confirme se todos os atributos data-* estão presentes
3. Verifique o console do navegador para erros
4. Use o Facebook Pixel Helper para debug
5. Verifique se há bloqueadores de anúncios interferindo 