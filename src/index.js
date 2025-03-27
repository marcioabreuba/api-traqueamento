const mongoose = require('mongoose');
const app = require('./app');
const config = require('./config/config');
const logger = require('./config/logger');
const { geoipService } = require('./services');

let server;

// Inicializar a base de dados GeoIP
geoipService.initialize()
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

mongoose.connect(config.mongoose.url, config.mongoose.options).then(() => {
  logger.info('Connected to MongoDB');
  server = app.listen(config.port, () => {
    logger.info(`Listening to port ${config.port}`);
  });
});

const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(1);
    });
  } else {
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
  logger.info('SIGTERM received');
  if (server) {
    server.close();
  }
});
