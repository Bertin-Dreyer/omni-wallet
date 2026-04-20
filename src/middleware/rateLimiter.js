import rateLimit from 'express-rate-limit';

// Rate limiting for financial endpoints
export const financialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: {
    status: false,
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // limit each IP to 3 requests per windowMs
  message: {
    status: false,
    error: 'Too many login attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});