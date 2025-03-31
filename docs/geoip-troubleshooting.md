# Solução de Problemas do GeoIP

## Problema Identificado

O serviço de GeoIP apresentava o seguinte erro ao tentar obter a localização de determinados IPs:

```
error: Unknown type NaN at offset XXXXXXX
```

Este erro ocorria devido a incompatibilidades entre a versão 6.0.0 da biblioteca `@maxmind/geoip2-node` e a base de dados GeoLite2-City, especialmente ao processar IPs de determinadas regiões como Brasil.

## Sintomas

- Erros "Unknown type NaN at offset" ao consultar determinados IPs
- Funcionamento inconsistente entre ambiente local e ambiente de produção (Render)
- A mesma base de dados funciona em um ambiente, mas falha em outro
- Os erros sempre ocorrem no mesmo offset para IPs da mesma região

## Soluções Implementadas

### 1. Downgrade da Biblioteca

A primeira medida implementada foi fazer downgrade da biblioteca `@maxmind/geoip2-node`:

```diff
- "@maxmind/geoip2-node": "6.0.0",
+ "@maxmind/geoip2-node": "5.0.0",
```

A versão 5.0.0 mostrou-se mais estável e compatível com a base de dados.

### 2. Sistema de Fallback Duplo

Implementamos um sistema de fallback robusto que usa duas bibliotecas diferentes:

- **Primário**: `@maxmind/geoip2-node` versão 5.0.0
- **Secundário**: `maxmind` (já estava nas dependências do projeto)

Este sistema tenta primeiro obter a localização com a biblioteca principal e, em caso de falha, usa a secundária.

### 3. Script de Diagnóstico

Foi implementado um script de diagnóstico que verifica a integridade da base de dados:

```bash
# Executar diagnóstico e teste da base GeoIP
npm run test-geoip
```

Este script:
- Verifica se a base GeoIP pode ser carregada corretamente
- Testa consultas com IPs conhecidos (IPv4 e IPv6)
- Identifica possíveis problemas de corrupção

### 4. Script de Correção

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

Este erro geralmente indica uma incompatibilidade entre a versão da biblioteca e a base de dados. Para corrigir:

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

### Caso Específico de IPs Brasileiros

Identificamos que os IPs brasileiros (faixas 177.x.x.x, 179.x.x.x, 186.x.x.x, etc.) causavam problemas específicos com a versão 6.0.0 da biblioteca. A combinação das duas soluções (downgrade + fallback) resolve esse problema.

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
   O tamanho normal deve ser aproximadamente 60MB.

2. Testar consultas básicas:
   ```bash
   node -e "const { Reader } = require('@maxmind/geoip2-node'); const fs = require('fs'); const reader = Reader.openBuffer(fs.readFileSync('./data/GeoLite2-City.mmdb')); console.log(reader.city('8.8.8.8'));"
   ```

## Implementação do Sistema de Fallback

O serviço GeoIP foi modificado para utilizar duas bibliotecas diferentes:

```javascript
// Inicialização de ambos readers
const initialize = async () => {
  // Inicializar o reader principal (@maxmind/geoip2-node)
  reader = Reader.openBuffer(dbBuffer);
  
  // Inicializar o reader de fallback (maxmind)
  fallbackReader = await maxmind.open(dbPath);
  
  // (resto do código...)
};

// Obtenção de localização com fallback
const getLocation = async (ip) => {
  // Tentar primeiro com o reader principal
  try {
    result = reader.city(ip);
    // ...
  } catch (primaryError) {
    // Se falhar, tentar com o reader de fallback
    try {
      const fallbackResult = fallbackReader.get(ip);
      // ...
    } catch (fallbackError) {
      // ...
    }
  }
  // (resto do código...)
};
```

## Histórico de Problemas Conhecidos

### Março de 2025 - Problema com IPs Brasileiros no Render
- **Sintoma**: Erros "Unknown type NaN at offset" ao consultar IPs específicos (especialmente IPs do Brasil)
- **Causa**: Incompatibilidade entre a versão 6.0.0 da biblioteca @maxmind/geoip2-node e a base GeoLite2-City
- **Solução**: Downgrade para versão 5.0.0 da biblioteca e implementação de sistema de fallback duplo 