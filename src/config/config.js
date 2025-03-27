const dotenv = require('dotenv');
const path = require('path');
const Joi = require('joi');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string().valid('production', 'development', 'test').required(),
    PORT: Joi.number().default(3000),
    MONGODB_URL: Joi.string().required().description('Mongo DB url'),
    JWT_SECRET: Joi.string().required().description('JWT secret key'),
    JWT_ACCESS_EXPIRATION_MINUTES: Joi.number().default(30).description('minutes after which access tokens expire'),
    JWT_REFRESH_EXPIRATION_DAYS: Joi.number().default(30).description('days after which refresh tokens expire'),
    JWT_RESET_PASSWORD_EXPIRATION_MINUTES: Joi.number()
      .default(10)
      .description('minutes after which reset password token expires'),
    JWT_VERIFY_EMAIL_EXPIRATION_MINUTES: Joi.number()
      .default(10)
      .description('minutes after which verify email token expires'),
    SMTP_HOST: Joi.string().description('server that will send the emails'),
    SMTP_PORT: Joi.number().description('port to connect to the email server'),
    SMTP_USERNAME: Joi.string().description('username for email server'),
    SMTP_PASSWORD: Joi.string().description('password for email server'),
    EMAIL_FROM: Joi.string().description('the from field in the emails sent by the app'),
    // Configurações GeoIP
    GEOIP_DB_PATH: Joi.string().description('Caminho para o banco de dados GeoIP'),
    // Configurações Facebook
    FB_API_URL: Joi.string().description('URL da API do Facebook'),
    FB_PIXEL_ID: Joi.string().description('ID do pixel do Facebook global'),
    FB_ACCESS_TOKEN: Joi.string().description('Token de acesso do Facebook global'),
    // Compatibilidade com nomes antigos
    CONVERSIONS_API_PIXEL_ID: Joi.string().description('ID do pixel (nome antigo)'),
    CONVERSIONS_API_ACCESS_TOKEN: Joi.string().description('Token de acesso (nome antigo)'),
    CONVERSIONS_API_TEST_CODE: Joi.string().description('Código de teste (nome antigo)'),
    // Configurações por produto/domínio
    PIXEL_ID_1: Joi.string().description('ID do pixel para o produto 1'),
    ACCESS_TOKEN_1: Joi.string().description('Token de acesso para o produto 1'),
    TEST_CODE_1: Joi.string().description('Código de teste para o produto 1'),
    PIXEL_ID_2: Joi.string().description('ID do pixel para o produto 2'),
    ACCESS_TOKEN_2: Joi.string().description('Token de acesso para o produto 2'),
    TEST_CODE_2: Joi.string().description('Código de teste para o produto 2'),
    // Maxmind
    MAXMIND_ACCOUNT_ID: Joi.string().description('ID de conta do MaxMind'),
    MAXMIND_LICENSE_KEY: Joi.string().description('Chave de licença do MaxMind'),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  mongoose: {
    url: envVars.MONGODB_URL + (envVars.NODE_ENV === 'test' ? '-test' : ''),
    options: {
      useCreateIndex: true,
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
    resetPasswordExpirationMinutes: envVars.JWT_RESET_PASSWORD_EXPIRATION_MINUTES,
    verifyEmailExpirationMinutes: envVars.JWT_VERIFY_EMAIL_EXPIRATION_MINUTES,
  },
  email: {
    smtp: {
      host: envVars.SMTP_HOST,
      port: envVars.SMTP_PORT,
      auth: {
        user: envVars.SMTP_USERNAME,
        pass: envVars.SMTP_PASSWORD,
      },
    },
    from: envVars.EMAIL_FROM,
  },
  facebook: {
    apiUrl: envVars.FB_API_URL || 'https://graph.facebook.com/v18.0',
    pixelId: envVars.FB_PIXEL_ID || envVars.CONVERSIONS_API_PIXEL_ID,
    accessToken: envVars.FB_ACCESS_TOKEN || envVars.CONVERSIONS_API_ACCESS_TOKEN,
    testCode: envVars.CONVERSIONS_API_TEST_CODE,
    // Configurações por produto/domínio
    products: {
      product1: {
        pixelId: envVars.PIXEL_ID_1,
        accessToken: envVars.ACCESS_TOKEN_1,
        testCode: envVars.TEST_CODE_1,
      },
      product2: {
        pixelId: envVars.PIXEL_ID_2,
        accessToken: envVars.ACCESS_TOKEN_2,
        testCode: envVars.TEST_CODE_2,
      },
    },
  },
  geoip: {
    dbPath: envVars.GEOIP_DB_PATH || './data/GeoLite2-City.mmdb',
  },
  maxmind: {
    accountId: envVars.MAXMIND_ACCOUNT_ID,
    licenseKey: envVars.MAXMIND_LICENSE_KEY,
  },
};
