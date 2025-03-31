# Solução de Problemas do GeoIP

## Problema Identificado

O serviço de GeoIP pode apresentar o seguinte erro ao tentar obter a localização de determinados IPs:

```
error: Unknown type NaN at offset XXXXXXX
```

Este erro ocorre devido a uma corrupção na estrutura interna do banco de dados GeoIP, geralmente causada durante a transferência do arquivo para o servidor ou durante o processo de deploy.

## Sintomas

- Erros "Unknown type NaN at offset" ao consultar determinados IPs
- Funcionamento inconsistente entre ambiente local e ambiente de produção (Render)
- A mesma base de dados funciona em um ambiente, mas falha em outro

## Soluções Implementadas

### 1. Script de Diagnóstico

Foi implementado um script de diagnóstico que verifica a integridade da base de dados:

```bash
# Executar diagnóstico e teste da base GeoIP
npm run test-geoip
```

Este script:
- Verifica se a base GeoIP pode ser carregada corretamente
- Testa consultas com IPs conhecidos (IPv4 e IPv6)
- Identifica possíveis problemas de corrupção

### 2. Script de Correção

Foi criado um script para facilitar a correção da base de dados GeoIP:

```bash
# Corrigir a base de dados GeoIP
npm run fix-geoip
```

Este script:
- Verifica a integridade da base atual
- Baixa uma nova cópia da base GeoLite2-City da MaxMind
- Cria um backup da base atual (se existir)
- Valida a integridade da nova base antes de substituir a atual
- Remove arquivos temporários após a conclusão

## Como Resolver Problemas Comuns

### Erro "Unknown type NaN at offset" no Render

Este erro geralmente indica que a base de dados foi corrompida durante o upload/deploy para o servidor. Para corrigir:

1. SSH para o servidor Render:
   ```bash
   ssh <usuário>@ssh.render.com
   ```

2. Navegar para o diretório do projeto:
   ```bash
   cd /opt/render/project/src
   ```

3. Executar o script de correção:
   ```bash
   npm run fix-geoip
   ```

4. Reiniciar o serviço:
   ```bash
   # Via Render Dashboard ou comando específico
   ```

### Atualizações Regulares

Para evitar problemas com versões desatualizadas, recomenda-se:

1. Atualizar a base de dados mensalmente:
   ```bash
   npm run update-geoip
   ```

2. Configurar um job cron para automatizar esta tarefa:
   ```bash
   # Exemplo: Atualizar no primeiro dia de cada mês às 03:00
   0 3 1 * * cd /caminho/do/projeto && npm run update-geoip
   ```

## Verificação Manual da Base

Para verificar manualmente a integridade da base GeoIP:

1. Verificar o tamanho do arquivo:
   ```bash
   ls -la data/GeoLite2-City.mmdb
   ```
   O tamanho normal deve ser aproximadamente 60-70MB.

2. Testar consultas básicas:
   ```bash
   node -e "const { Reader } = require('@maxmind/geoip2-node'); const fs = require('fs'); const reader = Reader.openBuffer(fs.readFileSync('./data/GeoLite2-City.mmdb')); console.log(reader.city('8.8.8.8'));"
   ```

## Procedimento para Ambiente de Produção

Em ambiente de produção, sempre siga este fluxo:

1. Realizar backup da base atual antes de qualquer atualização
2. Validar a nova base em ambiente de homologação antes de atualizar produção
3. Manter uma cópia da última versão funcional conhecida

## Histórico de Problemas Conhecidos

### Março de 2024 - Problema no Render
- **Sintoma**: Erros "Unknown type NaN at offset" ao consultar IPs específicos
- **Causa**: Corrupção da base durante deploy
- **Solução**: Script de correção implementado para baixar e validar nova base 