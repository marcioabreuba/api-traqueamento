const winston = require('winston');
const config = require('./config');

// Determinar o nível de log base com base no ambiente
const getBaseLogLevel = () => {
  if (process.env.DEBUG_GEOIP === 'true') {
    // Quando a variável de ambiente DEBUG_GEOIP é definida, usar nível de debug
    return 'debug';
  }

  // Caso contrário, usar o nível configurado ou fallback para 'info'
  return config.env === 'development' ? 'debug' : 'info';
};

const enumerateErrorFormat = winston.format((info) => {
  if (info instanceof Error) {
    Object.assign(info, { message: info.message, stack: info.stack });
  }
  return info;
});

const logger = winston.createLogger({
  level: getBaseLogLevel(),
  format: winston.format.combine(
    enumerateErrorFormat(),
    config.env === 'development' ? winston.format.colorize() : winston.format.uncolorize(),
    winston.format.splat(),
    winston.format.printf(({ level, message }) => `${level}: ${message}`)
  ),
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error']
    })
  ]
});

module.exports = logger;
