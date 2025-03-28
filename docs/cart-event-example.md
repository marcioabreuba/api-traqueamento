# Exemplo de Implementação do Evento AddToCart

## 1. No arquivo que lida com a adição ao carrinho (ex: cart.js)

```javascript
// Função para disparar o evento AddToCart
function triggerAddToCartEvent(product) {
  const event = new CustomEvent('addToCart', {
    detail: {
      productId: product.id,
      productName: product.name,
      price: product.price,
      quantity: product.quantity
    }
  });
  document.dispatchEvent(event);
}

// Exemplo de uso
document.querySelector('.add-to-cart-button').addEventListener('click', function(e) {
  e.preventDefault();
  
  const product = {
    id: this.dataset.productId,
    name: this.dataset.productName,
    price: this.dataset.productPrice,
    quantity: document.querySelector('.quantity-input').value
  };
  
  // Adiciona ao carrinho
  addToCart(product);
  
  // Dispara o evento para o Facebook Pixel
  triggerAddToCartEvent(product);
});
```

## 2. No HTML do botão de adicionar ao carrinho

```liquid
<button 
  class="add-to-cart-button"
  data-product-id="{{ product.id }}"
  data-product-name="{{ product.name }}"
  data-product-price="{{ product.price }}"
>
  Adicionar ao Carrinho
</button>
<input type="number" class="quantity-input" value="1" min="1">
```

## 3. Verificação

Para verificar se o evento está funcionando:

1. Abra o console do navegador
2. Clique no botão "Adicionar ao Carrinho"
3. Verifique se o evento é disparado no console
4. Use o Facebook Pixel Helper para confirmar que o evento foi registrado
5. Verifique no Facebook Events Manager se o evento aparece

## 4. Dados do Evento

O evento AddToCart envia os seguintes dados:

```javascript
{
  content_type: 'product',
  content_ids: ['123'], // ID do produto
  content_name: 'Nome do Produto',
  value: 99.90, // Valor do produto
  currency: 'BRL',
  num_items: 1 // Quantidade
}
```

## 5. Tratamento de Erros

```javascript
function triggerAddToCartEvent(product) {
  try {
    const event = new CustomEvent('addToCart', {
      detail: {
        productId: product.id,
        productName: product.name,
        price: product.price,
        quantity: product.quantity
      }
    });
    document.dispatchEvent(event);
  } catch (error) {
    console.error('Erro ao disparar evento AddToCart:', error);
    // Implemente aqui sua lógica de fallback ou notificação
  }
}
``` 