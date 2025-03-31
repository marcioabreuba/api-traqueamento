# API de Rastreamento e Conversões do Facebook

API profissional para rastreamento e conversões do Facebook, construída com Node.js, Express e Prisma.

## Tecnologias Utilizadas

- Node.js
- Express
- Prisma (PostgreSQL)
- JWT para autenticação
- Facebook Conversion API
- GeoIP para rastreamento de localização

## Pré-requisitos

- Node.js >= 12.0.0
- PostgreSQL
- Conta no Facebook Business
- Conta no Render (para deploy)

## Instalação

1. Clone o repositório:
```bash
git clone https://github.com/marcioabreuba/api-traqueamento.git
cd api-traqueamento
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```
Edite o arquivo `.env` com suas configurações.

4. Execute as migrações do banco de dados:
```bash
npx prisma generate
npx prisma migrate dev
```

## Desenvolvimento

Para iniciar o servidor em modo desenvolvimento:
```bash
npm run dev
```

## Testes

Para executar os testes:
```bash
npm test
```

## Deploy no Render

1. Crie uma conta no Render (https://render.com)
2. Crie um novo banco de dados PostgreSQL
3. Crie um novo Web Service
4. Conecte seu repositório GitHub
5. Configure as variáveis de ambiente conforme `.env.example`

## Estrutura do Projeto

```
src/
├── config/         # Configurações do projeto
├── controllers/    # Controladores da API
├── models/         # Modelos do Prisma
├── routes/         # Rotas da API
├── services/       # Serviços da aplicação
├── utils/          # Utilitários
└── index.js        # Ponto de entrada
```

## Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## Funcionalidades do GeoIP

### Correção Automática da Base GeoIP

O serviço agora inclui um mecanismo automático de correção e atualização da base de dados GeoIP. Quando o servidor é iniciado com `yarn start` ou `npm start`, o script de correção da base GeoIP é executado automaticamente antes da inicialização do serviço.

### Como Funciona

1. **Durante a inicialização do serviço:**
   - O script `fix-geoip.js` é executado automaticamente
   - Verifica se a base de dados GeoIP existe e está íntegra
   - Baixa uma nova base se necessário
   - Valida a nova base antes de substituir a atual
   - Inicia o serviço com a base atualizada

2. **No ambiente Render:**
   - O processo é totalmente automatizado
   - Detecção automática do ambiente Render e execução em modo não-interativo
   - Sem necessidade de intervenção manual

### Comandos Disponíveis

- **Iniciar serviço com correção automática da base GeoIP:**
  ```bash
  npm start
  # ou
  yarn start
  ```

- **Executar apenas a correção da base GeoIP:**
  ```bash
  npm run fix-geoip
  # ou
  yarn fix-geoip
  ```

- **Executar a correção em modo não-interativo:**
  ```bash
  npm run fix-geoip -- --auto
  # ou
  yarn fix-geoip --auto
  ```

- **Testar a base GeoIP atual:**
  ```bash
  npm run test-geoip
  # ou
  yarn test-geoip
  ```

### Sistema de Fallback para IPs Brasileiros

O serviço implementa um sistema robusto de fallback triplo para garantir que mesmo quando ocorrerem erros na consulta da base GeoIP, especialmente para IPs brasileiros, o sistema ainda fornecerá dados geográficos básicos:

1. **Nível 1:** Tentativa com biblioteca principal (@maxmind/geoip2-node)
2. **Nível 2:** Em caso de falha, tentativa com biblioteca alternativa (maxmind)
3. **Nível 3:** Se ambas falharem, uso de dados estáticos para IPs brasileiros conhecidos

### Depuração de Problemas com GeoIP

Para habilitar logs mais detalhados relacionados ao GeoIP, defina a variável de ambiente:

```bash
# No Linux/Mac
export DEBUG_GEOIP=true

# No Windows
set DEBUG_GEOIP=true

# No Render (variável de ambiente)
DEBUG_GEOIP=true
```
