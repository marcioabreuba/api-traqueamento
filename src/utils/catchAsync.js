const ApiError = require('./ApiError');
const httpStatus = require('http-status');

const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next))
    .catch((err) => {
      // Se o erro já for um ApiError, passa para o próximo middleware
      if (err instanceof ApiError) {
        return next(err);
      }

      // Se for um erro do Prisma, converte para ApiError
      if (err.name === 'PrismaClientKnownRequestError') {
        const apiError = new ApiError(httpStatus.BAD_REQUEST, err.message, false, err.stack);
        return next(apiError);
      }

      // Para outros erros, converte para ApiError com status 500
      const apiError = new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        err.message || 'Erro interno do servidor',
        false,
        err.stack
      );
      return next(apiError);
    });
};

module.exports = catchAsync;
