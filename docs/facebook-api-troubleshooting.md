# Solução de Problemas com a API do Facebook

Este documento fornece informações sobre problemas comuns encontrados ao usar a API de Conversões do Facebook e como resolvê-los.

## Problemas com Timestamp (event_time)

### Problema: "Invalid parameter" - "Parameter value is invalid, future or not in the correct unix format"

Se você receber uma mensagem de erro indicando que o timestamp é inválido, futuro ou não está no formato unix correto, isso pode ser causado por:

1. **Timestamp em formato incorreto**: O Facebook exige que o timestamp seja um número inteiro Unix em segundos (não milissegundos).
2. **Timestamp no futuro**: O Facebook rejeita eventos com data/hora no futuro.
3. **Timestamp muito antigo**: O Facebook apenas aceita eventos ocorridos nos últimos 7 dias.

### Solução

Nós implementamos uma solução robusta para lidar com esses problemas automaticamente:

1. **Normalização de formato**: Convertemos automaticamente qualquer timestamp em milissegundos para segundos.
2. **Validação de data futura**: Qualquer timestamp futuro é ajustado para o momento atual.
3. **Validação de data antiga**: Timestamps mais antigos que 7 dias são ajustados para o limite permitido.

A lógica de correção está implementada tanto no `event.service.js` quanto no `facebook.service.js` para garantir redundância na validação.

## Problemas com Dados de Usuário

### Problema: Dados de localização (city, state, country) não sendo aceitos

Certifique-se de que:

1. Os códigos de país estão no formato ISO (ex: "BR" para Brasil).
2. Os nomes de estado e cidade estão normalizados conforme as especificações do Facebook.

## Problemas de Conexão

### Problema: Timeout ou falha de conexão com a API

Se encontrar erros de timeout ou conexão:

1. Verifique se o servidor tem acesso à internet.
2. Confirme se os endpoints do Facebook não estão bloqueados por firewalls.
3. Verifique se os limites de rate não foram excedidos.

## Debug e Logs

Para ajudar na solução de problemas:

1. Ative logs detalhados definindo a variável de ambiente `DETAILED_GEOIP_LOGS=true`.
2. Verifique os logs do sistema para mensagens de aviso sobre normalização de timestamp.
3. Use o código de teste do Facebook para verificar eventos sem que eles impactem suas métricas reais.

## Referências

- [Documentação oficial da Facebook Conversions API](https://developers.facebook.com/docs/marketing-api/conversions-api/)
- [Parâmetros de data e tempo do Facebook](https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters) 