# Configuração no Render

Este documento descreve o processo de configuração do serviço no ambiente Render.

## Variáveis de Ambiente

Adicione as seguintes variáveis de ambiente no painel do Render:

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| `MAXMIND_LICENSE_KEY` | Chave de licença para download da base GeoIP | Sim |
| `DEBUG_GEOIP` | Habilita logs de debug para o GeoIP (true/false) | Não |
| `DATABASE_URL` | URL de conexão com o banco de dados | Sim |
| `NODE_ENV` | Ambiente de execução | Sim |
| `PORT` | Porta em que o serviço será executado | Não (padrão: 3000) |

## Configuração do GeoIP

Para garantir que a geolocalização funcione corretamente, é necessário configurar a variável `MAXMIND_LICENSE_KEY` com uma chave de licença válida do MaxMind. Para obter uma chave:

1. Crie uma conta gratuita em [MaxMind](https://www.maxmind.com/en/geolite2/signup)
2. Faça login e acesse "My License Key" no menu da conta
3. Gere uma nova chave de licença para download da base GeoLite2
4. Copie a chave e adicione à variável de ambiente `MAXMIND_LICENSE_KEY` no Render

## Problemas Comuns

### Erro 401 no Download da Base GeoIP

```
Erro fatal: Error: Falha no download. Status code: 401
```

Este erro indica que a chave de licença para download da base GeoIP é inválida ou não foi configurada. Verifique:

1. Se a variável `MAXMIND_LICENSE_KEY` está configurada no Render
2. Se a chave de licença é válida e tem permissão para baixar a base GeoLite2-City
3. Se a conta MaxMind não expirou

### Correção Manual da Base GeoIP

Se necessário, é possível atualizar a base GeoIP manualmente usando o shell do Render:

1. Acesse o shell do serviço no Render
2. Execute o seguinte comando:

```bash
bash /opt/render/project/src/scripts/download-geoip.sh
```

## Inicialização do Serviço

O serviço está configurado para tentar atualizar a base GeoIP durante a inicialização, usando o comando:

```
node scripts/fix-geoip.js && node src/index.js || node src/index.js
```

Esta configuração garante que:
1. O serviço tentará atualizar a base GeoIP primeiro
2. Mesmo que a atualização falhe, o serviço será iniciado normalmente
3. O sistema de fallback para IPs brasileiros garantirá o funcionamento do serviço mesmo com problemas na base

## Monitoramento

Para monitorar problemas relacionados ao GeoIP, configure a variável `DEBUG_GEOIP=true` e verifique os logs do serviço no painel do Render. 