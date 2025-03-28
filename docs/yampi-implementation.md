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
<div class="product" 
  data-product-id="{{ product.id }}"
  data-variant-id="{{ product.selected_or_first_available_variant.id }}"
  data-product-name="{{ product.title | strip_html | escape | strip_newlines }}"
  data-product-price="{{ product.selected_or_first_available_variant.price | money_without_currency }}"
  data-product-sku="{{ product.selected_or_first_available_variant.sku | strip_html | escape }}"
  data-product-brand="{{ product.vendor }}"
  data-product-variant="{{ product.selected_or_first_available_variant.title | strip_html | escape }}"
  data-product-category="{{ product.type | strip_html | escape }}"
  data-product-quantity="1">
  <h1>{{ product.title }}</h1>
  <span>{{ product.selected_or_first_available_variant.price }}</span>
  <button 
    data-add-to-cart
    data-product-id="{{ product.id }}"
    data-variant-id="{{ product.selected_or_first_available_variant.id }}"
    data-product-name="{{ product.title | strip_html | escape | strip_newlines }}"
    data-product-price="{{ product.selected_or_first_available_variant.price | money_without_currency }}"
    data-product-sku="{{ product.selected_or_first_available_variant.sku | strip_html | escape }}"
    data-product-brand="{{ product.vendor }}"
    data-product-variant="{{ product.selected_or_first_available_variant.title | strip_html | escape }}"
    data-product-category="{{ product.type | strip_html | escape }}"
    data-product-quantity="1">
    Adicionar ao Carrinho
  </button>
  <input type="number" data-quantity-{{ product.id }} value="1" min="1">
</div>
```

### Lista de Produtos
```liquid
<div class="products-list">
  {% for product in products %}
    <div class="product-item" 
      data-product-item 
      data-product-id="{{ product.id }}"
      data-variant-id="{{ product.selected_or_first_available_variant.id }}"
      data-product-name="{{ product.title | strip_html | escape | strip_newlines }}"
      data-product-price="{{ product.selected_or_first_available_variant.price | money_without_currency }}"
      data-product-sku="{{ product.selected_or_first_available_variant.sku | strip_html | escape }}"
      data-product-brand="{{ product.vendor }}"
      data-product-variant="{{ product.selected_or_first_available_variant.title | strip_html | escape }}"
      data-product-category="{{ product.type | strip_html | escape }}"
      data-product-quantity="{{ product.selected_or_first_available_variant.inventory_quantity }}">
      <h2>{{ product.title }}</h2>
      <span>{{ product.selected_or_first_available_variant.price }}</span>
      <button 
        data-add-to-cart
        data-product-id="{{ product.id }}"
        data-variant-id="{{ product.selected_or_first_available_variant.id }}"
        data-product-name="{{ product.title | strip_html | escape | strip_newlines }}"
        data-product-price="{{ product.selected_or_first_available_variant.price | money_without_currency }}"
        data-product-sku="{{ product.selected_or_first_available_variant.sku | strip_html | escape }}"
        data-product-brand="{{ product.vendor }}"
        data-product-variant="{{ product.selected_or_first_available_variant.title | strip_html | escape }}"
        data-product-category="{{ product.type | strip_html | escape }}"
        data-product-quantity="1">
        Adicionar ao Carrinho
      </button>
      <input type="number" data-quantity-{{ product.id }} value="1" min="1">
    </div>
  {% endfor %}
</div>
```

### Categoria
```liquid
<div class="category" data-category-id="{{ category.id }}">
  <h1 data-category-name="{{ category.name }}">{{ category.name }}</h1>
  <div class="products-list">
    {% for product in category.products %}
      <div class="product-item" data-product-item data-product-id="{{ product.id }}">
        <h2>{{ product.name }}</h2>
        <span>{{ product.price }}</span>
        <button 
          data-add-to-cart
          data-product-id="{{ product.id }}"
          data-product-name="{{ product.name }}"
          data-product-price="{{ product.price }}"
        >
          Adicionar ao Carrinho
        </button>
        <input type="number" data-quantity-{{ product.id }} value="1" min="1">
      </div>
    {% endfor %}
  </div>
</div>
```

### Resultados de Busca
```liquid
<div class="search-results">
  {% for product in search.results %}
    <div class="search-result" data-search-result data-product-id="{{ product.id }}">
      <h2>{{ product.name }}</h2>
      <span>{{ product.price }}</span>
      <button 
        data-add-to-cart
        data-product-id="{{ product.id }}"
        data-product-name="{{ product.name }}"
        data-product-price="{{ product.price }}"
      >
        Adicionar ao Carrinho
      </button>
      <input type="number" data-quantity-{{ product.id }} value="1" min="1">
    </div>
  {% endfor %}
</div>
```

### Carrinho
```liquid
<div class="cart" data-cart-container data-cart-total="{{ cart.total_price | money_without_currency }}">
  {% for item in cart.items %}
    <div class="cart-item" 
      data-cart-item 
      data-product-id="{{ item.product_id }}"
      data-variant-id="{{ item.variant_id }}"
      data-product-name="{{ item.title | strip_html | escape | strip_newlines }}"
      data-product-price="{{ item.variant.price | money_without_currency }}"
      data-product-sku="{{ item.variant.sku | strip_html | escape }}"
      data-product-brand="{{ item.vendor }}"
      data-product-variant="{{ item.variant.title | strip_html | escape }}"
      data-product-category="{{ item.product.type | strip_html | escape }}"
      data-product-quantity="{{ item.quantity }}">
      <h3>{{ item.title }}</h3>
      <span>{{ item.variant.price }}</span>
      <span>Quantidade: {{ item.quantity }}</span>
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

## Atributos Data Necessários

### Página de Produto
```liquid
<div class="product" 
  data-product-id="{{ product.id }}"
  data-variant-id="{{ product.selected_or_first_available_variant.id }}"
  data-product-name="{{ product.title | strip_html | escape | strip_newlines }}"
  data-product-price="{{ product.selected_or_first_available_variant.price | money_without_currency }}"
  data-product-sku="{{ product.selected_or_first_available_variant.sku | strip_html | escape }}"
  data-product-brand="{{ product.vendor }}"
  data-product-variant="{{ product.selected_or_first_available_variant.title | strip_html | escape }}"
  data-product-category="{{ product.type | strip_html | escape }}"
  data-product-quantity="1">
  <h1>{{ product.title }}</h1>
  <span>{{ product.selected_or_first_available_variant.price }}</span>
  <button 
    data-add-to-cart
    data-product-id="{{ product.id }}"
    data-variant-id="{{ product.selected_or_first_available_variant.id }}"
    data-product-name="{{ product.title | strip_html | escape | strip_newlines }}"
    data-product-price="{{ product.selected_or_first_available_variant.price | money_without_currency }}"
    data-product-sku="{{ product.selected_or_first_available_variant.sku | strip_html | escape }}"
    data-product-brand="{{ product.vendor }}"
    data-product-variant="{{ product.selected_or_first_available_variant.title | strip_html | escape }}"
    data-product-category="{{ product.type | strip_html | escape }}"
    data-product-quantity="1">
    Adicionar ao Carrinho
  </button>
  <input type="number" data-quantity-{{ product.id }} value="1" min="1">
</div>
```

### Lista de Produtos
```liquid
<div class="products-list">
  {% for product in products %}
    <div class="product-item" 
      data-product-item 
      data-product-id="{{ product.id }}"
      data-variant-id="{{ product.selected_or_first_available_variant.id }}"
      data-product-name="{{ product.title | strip_html | escape | strip_newlines }}"
      data-product-price="{{ product.selected_or_first_available_variant.price | money_without_currency }}"
      data-product-sku="{{ product.selected_or_first_available_variant.sku | strip_html | escape }}"
      data-product-brand="{{ product.vendor }}"
      data-product-variant="{{ product.selected_or_first_available_variant.title | strip_html | escape }}"
      data-product-category="{{ product.type | strip_html | escape }}"
      data-product-quantity="{{ product.selected_or_first_available_variant.inventory_quantity }}">
      <h2>{{ product.title }}</h2>
      <span>{{ product.selected_or_first_available_variant.price }}</span>
      <button 
        data-add-to-cart
        data-product-id="{{ product.id }}"
        data-variant-id="{{ product.selected_or_first_available_variant.id }}"
        data-product-name="{{ product.title | strip_html | escape | strip_newlines }}"
        data-product-price="{{ product.selected_or_first_available_variant.price | money_without_currency }}"
        data-product-sku="{{ product.selected_or_first_available_variant.sku | strip_html | escape }}"
        data-product-brand="{{ product.vendor }}"
        data-product-variant="{{ product.selected_or_first_available_variant.title | strip_html | escape }}"
        data-product-category="{{ product.type | strip_html | escape }}"
        data-product-quantity="1">
        Adicionar ao Carrinho
      </button>
      <input type="number" data-quantity-{{ product.id }} value="1" min="1">
    </div>
  {% endfor %}
</div>
```

### Carrinho
```liquid
<div class="cart" data-cart-container data-cart-total="{{ cart.total_price | money_without_currency }}">
  {% for item in cart.items %}
    <div class="cart-item" 
      data-cart-item 
      data-product-id="{{ item.product_id }}"
      data-variant-id="{{ item.variant_id }}"
      data-product-name="{{ item.title | strip_html | escape | strip_newlines }}"
      data-product-price="{{ item.variant.price | money_without_currency }}"
      data-product-sku="{{ item.variant.sku | strip_html | escape }}"
      data-product-brand="{{ item.vendor }}"
      data-product-variant="{{ item.variant.title | strip_html | escape }}"
      data-product-category="{{ item.product.type | strip_html | escape }}"
      data-product-quantity="{{ item.quantity }}">
      <h3>{{ item.title }}</h3>
      <span>{{ item.variant.price }}</span>
      <span>Quantidade: {{ item.quantity }}</span>
    </div>
  {% endfor %}
</div>
```

### Categoria
```liquid
<div class="category" data-category-id="{{ category.id }}">
  <h1 data-category-name="{{ category.name }}">{{ category.name }}</h1>
  <div class="products-list">
    {% for product in category.products %}
      <div class="product-item" data-product-item data-product-id="{{ product.id }}">
        <h2>{{ product.name }}</h2>
        <span>{{ product.price }}</span>
        <button 
          data-add-to-cart
          data-product-id="{{ product.id }}"
          data-product-name="{{ product.name }}"
          data-product-price="{{ product.price }}"
        >
          Adicionar ao Carrinho
        </button>
        <input type="number" data-quantity-{{ product.id }} value="1" min="1">
      </div>
    {% endfor %}
  </div>
</div>
```

### Resultados de Busca
```liquid
<div class="search-results">
  {% for product in search.results %}
    <div class="search-result" data-search-result data-product-id="{{ product.id }}">
      <h2>{{ product.name }}</h2>
      <span>{{ product.price }}</span>
      <button 
        data-add-to-cart
        data-product-id="{{ product.id }}"
        data-product-name="{{ product.name }}"
        data-product-price="{{ product.price }}"
      >
        Adicionar ao Carrinho
      </button>
      <input type="number" data-quantity-{{ product.id }} value="1" min="1">
    </div>
  {% endfor %}
</div>
```

## Eventos Implementados

### ViewContent
- Disparado ao visualizar um produto
- Requer atributos: data-product-id, data-product-name, data-product-price

### ViewList
- Disparado em listas de produtos (categorias e busca)
- Requer atributos: data-product-item, data-product-id

### ViewCart
- Disparado ao visualizar o carrinho
- Requer atributos: data-cart-container, data-cart-total, data-cart-item

### AddToCart
- Disparado ao adicionar produto ao carrinho
- Requer atributos: data-add-to-cart, data-product-id, data-product-name, data-product-price, data-quantity-{id}

## Validação e Tratamento de Erros

O sistema implementa:
1. Validação de campos obrigatórios
2. Sistema de retry para falhas de rede
3. Logs de erro detalhados
4. Limpeza automática de observers

## Testes

Para verificar se os eventos estão funcionando:
1. Use o Facebook Pixel Helper
2. Verifique o console do navegador para logs de erro
3. Teste cada evento individualmente
4. Verifique se os dados estão sendo enviados corretamente

## Observações

- Todos os valores monetários devem estar no formato brasileiro
- IDs de produtos devem ser únicos
- Quantidades devem ser números inteiros positivos
- O sistema limpa automaticamente os observers ao fechar a página 