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
