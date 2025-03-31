const { PrismaClient } = require('@prisma/client');
const app = require('./app');
const config = require('./config/config');
const logger = require('./config/logger');
const { geoipService } = require('./services');

let server;
const prisma = new PrismaClient();

// Inicializar a base de dados GeoIP
geoipService
  .initialize()
  .then((success) => {
    if (success) {
      logger.info('Base de dados GeoIP inicializada com sucesso');
    } else {
      logger.warn('Não foi possível inicializar a base de dados GeoIP');
    }
  })
  .catch((error) => {
    logger.error(`Erro ao inicializar GeoIP: ${error.message}`);
  });

// Inicializar o servidor
const startServer = async () => {
  try {
    // Testar conexão com o banco de dados
    await prisma.$connect();
    logger.info('Conexão com o banco de dados estabelecida com sucesso');

    // Iniciar o servidor
    server = app.listen(config.port, () => {
      logger.info(`Servidor rodando na porta ${config.port}`);
    });
  } catch (error) {
    logger.error('Erro ao iniciar o servidor:', error);
    process.exit(1);
  }
};

// Iniciar o servidor
startServer();

const exitHandler = async () => {
  try {
    await prisma.$disconnect();
    if (server) {
      server.close(() => {
        logger.info('Servidor encerrado');
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  } catch (error) {
    logger.error('Erro ao encerrar o servidor:', error);
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error) => {
  logger.error(error);
  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM recebido');
  if (server) {
    server.close();
  }
});
