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

### 1. Sistema de Fallback Triplo (3 níveis)

Implementamos um sistema de fallback robusto com 3 níveis:

1. **Nível 1**: Tentar com a biblioteca `@maxmind/geoip2-node` (versão 6.0.0)
2. **Nível 2**: Em caso de falha, tentar com a biblioteca alternativa `maxmind`
3. **Nível 3**: Se ambas falharem, usar um fallback estático para IPs brasileiros conhecidos

### 2. Detecção Inteligente de IPs Brasileiros

Adicionamos uma função que identifica IPs brasileiros com base em faixas conhecidas:

```javascript
const BRAZILIAN_IP_PREFIXES = [
  '177.', '179.', '186.', '187.', '189.', '191.', '200.', '201.', 
  '187.', '45.', '143.', '152.', '168.', '170.', '168.'
];

const isBrazilianIP = (ip) => {
  if (!ip || typeof ip !== 'string') return false;
  
  // Limpar prefixo IPv6 se presente
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  
  // Verificar se o IP começa com algum dos prefixos conhecidos do Brasil
  return BRAZILIAN_IP_PREFIXES.some(prefix => ip.startsWith(prefix));
};
```

### 3. Dados de Fallback para IPs Brasileiros

Criamos um conjunto mínimo de dados para IPs brasileiros que falham em ambos os readers:

```javascript
const getBrazilianFallbackData = () => {
  return {
    country: 'Brasil',
    city: '',
    subdivision: '',
    postal: '',
    latitude: -14.235,  // Coordenadas aproximadas do centro do Brasil
    longitude: -51.9253,
    timezone: 'America/Sao_Paulo',
    accuracyRadius: 1000
  };
};
```

### 4. Script de Diagnóstico

Foi implementado um script de diagnóstico que verifica a integridade da base de dados:

```bash
# Executar diagnóstico e teste da base GeoIP
npm run test-geoip
```

Este script:
- Verifica se a base GeoIP pode ser carregada corretamente
- Testa consultas com IPs conhecidos (IPv4 e IPv6)
- Identifica possíveis problemas de corrupção

### 5. Script de Correção

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

Este erro geralmente indica uma incompatibilidade entre a versão da biblioteca e a base de dados. As soluções implementadas lidam com este problema de três formas:

1. Tentativa com a primeira biblioteca
2. Tentativa com a segunda biblioteca alternativa
3. Uso de dados de fallback para IPs brasileiros quando ambas as tentativas falham

### Caso Específico de IPs Brasileiros

Identificamos que os IPs brasileiros (faixas 177.x.x.x, 179.x.x.x, 186.x.x.x, etc.) causavam problemas específicos. A solução implementada garante que mesmo se os métodos regulares falharem, o sistema ainda retornará dados geográficos básicos para o Brasil.

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

## Implementação do Sistema de Fallback Triplo

O serviço GeoIP foi modificado para utilizar um sistema robusto de fallback em três camadas:

```javascript
const getLocation = async (ip) => {
  try {
    // Verificações iniciais...
    
    // Nível 1: Tentar com o reader principal (@maxmind/geoip2-node)
    if (reader) {
      try {
        result = reader.city(ip);
        locationData = extractLocationData(result);
        // ...
      } catch (primaryError) {
        // Tratamento de erros e tentativas com variações do IP...
      }
    }

    // Nível 2: Se o reader principal falhou, tentar com o reader de fallback (maxmind)
    if (!locationData && fallbackReader) {
      try {
        const fallbackResult = fallbackReader.get(ip);
        // Processamento do resultado...
      } catch (fallbackError) {
        // Tratamento de erros...
      }
    }

    // Nível 3: Fallback para IPs brasileiros conhecidos
    if (!locationData && isBrazilianIP(ip)) {
      logger.info(`Usando dados de fallback para IP brasileiro: ${ip}`);
      locationData = getBrazilianFallbackData();
    }

    // Processamento final e resposta...
  } catch (error) {
    // Tratamento de erros gerais...
  }
};
```

## Histórico de Problemas Conhecidos

### Março de 2025 - Problema com IPs Brasileiros no Render
- **Sintoma**: Erros "Unknown type NaN at offset" ao consultar IPs específicos (especialmente IPs do Brasil)
- **Causa**: Incompatibilidade entre a versão 6.0.0 da biblioteca @maxmind/geoip2-node e a base GeoLite2-City
- **Solução**: Implementação de um sistema de fallback triplo com detecção específica para IPs brasileiros 