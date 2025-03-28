# Documentação do Webhook da Yampi

## Eventos do Checkout

### InitiateCheckout
- **Evento Yampi**: `checkout.started`
- **Descrição**: Disparado quando o cliente chega à página de checkout
- **Dados Adicionais**: 
  - `order.total`: Valor total do pedido
  - `order.items`: Lista de produtos
  - `order.currency`: Moeda do pedido

### StartCheckout
- **Evento Yampi**: `checkout.form_started`
- **Descrição**: Disparado quando o cliente começa a preencher informações pessoais
- **Dados Adicionais**:
  - `customer.first_name`: Nome do cliente
  - `customer.last_name`: Sobrenome do cliente
  - `customer.email`: Email do cliente

### RegisterDone
- **Evento Yampi**: `checkout.form_completed`
- **Descrição**: Disparado quando o cliente conclui o registro no checkout
- **Dados Adicionais**:
  - `customer`: Dados completos do cliente
  - `order`: Dados do pedido

### AddShippingInfo
- **Evento Yampi**: `checkout.shipping_added`
- **Descrição**: Disparado quando o cliente adiciona informações de envio
- **Dados Adicionais**:
  - `order.shipping_address`: Endereço de entrega
  - `order.shipping_method`: Método de envio

### AddPaymentInfo
- **Evento Yampi**: `checkout.payment_added`
- **Descrição**: Disparado quando o cliente adiciona informações de pagamento
- **Dados Adicionais**:
  - `payment_method`: Método de pagamento
  - `payment_status`: Status do pagamento

### AddCoupon
- **Evento Yampi**: `checkout.coupon_added`
- **Descrição**: Disparado quando o cliente adiciona um cupom
- **Dados Adicionais**:
  - `coupon_code`: Código do cupom
  - `discount_value`: Valor do desconto

### Refused - credit_card
- **Evento Yampi**: `order.payment_failed`
- **Descrição**: Disparado quando um pagamento com cartão é recusado
- **Dados Adicionais**:
  - `error_message`: Mensagem de erro
  - `payment_status`: Status do pagamento

### Purchase
- **Evento Yampi**: `order.paid`
- **Descrição**: Disparado quando uma compra é concluída
- **Dados Adicionais**:
  - `order.total`: Valor total
  - `payment_status`: Status do pagamento
  - `payment_method`: Método de pagamento

### Purchase - pix
- **Evento Yampi**: `order.paid_pix`
- **Descrição**: Disparado quando uma compra é feita via PIX
- **Dados Adicionais**:
  - `pix_code`: Código PIX
  - `payment_status`: Status do pagamento

### Purchase - paid_pix
- **Evento Yampi**: `order.paid_pix`
- **Descrição**: Disparado quando o PIX é confirmado
- **Dados Adicionais**:
  - `pix_code`: Código PIX
  - `payment_status`: Status do pagamento

### Purchase - credit_card
- **Evento Yampi**: `order.paid_credit_card`
- **Descrição**: Disparado quando uma compra é feita com cartão
- **Dados Adicionais**:
  - `installments`: Número de parcelas
  - `payment_status`: Status do pagamento

### Purchase - billet
- **Evento Yampi**: `order.paid_billet`
- **Descrição**: Disparado quando uma compra é feita com boleto
- **Dados Adicionais**:
  - `billet_url`: URL do boleto
  - `payment_status`: Status do pagamento

### Purchase - high_ticket
- **Evento Yampi**: `order.paid_high_ticket`
- **Descrição**: Disparado quando uma compra de alto valor é feita
- **Dados Adicionais**:
  - `total_value`: Valor total
  - `payment_status`: Status do pagamento

## Exemplo de Payload

```json
{
  "event": "checkout.started",
  "order": {
    "id": "123456",
    "total": 199.90,
    "currency": "BRL",
    "ip_address": "192.168.1.1",
    "items": [
      {
        "product_id": "789",
        "name": "Produto Exemplo",
        "quantity": 1,
        "price": 199.90
      }
    ],
    "shipping_address": {
      "city": "São Paulo",
      "state": "SP",
      "country": "Brasil",
      "zip_code": "01001-000"
    }
  },
  "customer": {
    "id": "456",
    "email": "cliente@exemplo.com",
    "phone": "11999999999",
    "first_name": "João",
    "last_name": "Silva"
  },
  "store": {
    "id": "789",
    "domain": "minhaloja.com"
  },
  "payment_method": "credit_card",
  "payment_status": "pending",
  "total_value": 199.90
}
``` 