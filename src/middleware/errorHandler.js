const { AppError } = require('../utils/errors');
const config = require('../config');

/**
 * Global error handling middleware.
 * Must be registered after all routes.
 */
function errorHandler(err, req, res, _next) {
  // Log the error in development
  if (config.isDevelopment() || config.isTest()) {
    console.error('Error:', err.message);
    if (!err.isOperational) {
      console.error(err.stack);
    }
  }

  // Prisma known errors
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'A record with that value already exists',
      details: err.meta,
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      error: 'Record not found',
    });
  }

  // Application errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  // Unexpected errors
  res.status(500).json({
    error: config.isProduction() ? 'Internal server error' : err.message,
  });
}

module.exports = { errorHandler };
