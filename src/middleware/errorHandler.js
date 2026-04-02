import { config } from "../config/index.js";

function errorHandler(err, req, res, next) {
  // Always log in development, never in production
  if (config.env === 'development') {
    console.error(err.stack);
  } else {
    // Production: log only essential info, never stack traces
    console.error(`[${new Date().toISOString()}] ${err.name}: ${err.code || err.message}`);
  }

  // Handle JWT Errors
  if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: false,
      error: 'Invalid or expired token',
    });
  }

  // Handle Validation Errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      status: false,
      error: config.env === 'development' ? err.message : 'Validation failed',
    });
  }

  // Handle Known Errors (with statusCode)
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: false,
    error: config.env === 'development'
      ? (err.message || 'Internal Server Error')
      : 'Internal Server Error',
  });
}

export default errorHandler;
