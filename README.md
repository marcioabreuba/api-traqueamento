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

### Atualizando a Base GeoIP

A base de dados GeoIP precisa ser atualizada manualmente quando necessário.

#### Local/Desenvolvimento

Execute o script de atualização:

```bash
npm run fix-geoip
# ou
yarn fix-geoip
```

#### Ambiente Render (Produção)

No shell do Render, execute:

```bash
bash /opt/render/project/src/scripts/download-geoip.sh
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

Para mais detalhes sobre a configuração no ambiente Render, consulte [docs/rendering-setup.md](docs/rendering-setup.md).

## Variáveis de Ambiente

O projeto utiliza variáveis de ambiente para configuração. Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```
# Banco de dados
DATABASE_URL=postgresql://user:password@localhost:5432/database

# Ambiente
NODE_ENV=development
PORT=3000

# GeoIP
MAXMIND_LICENSE_KEY=sua_chave_aqui
DEBUG_GEOIP=false
```

### Variável MAXMIND_LICENSE_KEY

Para funcionar corretamente, o serviço de GeoIP precisa de uma chave de licença válida do MaxMind para download da base de dados. Para obter uma chave gratuita:

1. Crie uma conta em [MaxMind](https://www.maxmind.com/en/geolite2/signup)
2. Acesse "My License Key" no menu da conta
3. Gere uma nova chave de licença
4. Adicione à variável `MAXMIND_LICENSE_KEY` no arquivo `.env` ou no ambiente Render

Para mais detalhes sobre a configuração no ambiente Render, consulte [docs/rendering-setup.md](docs/rendering-setup.md).
