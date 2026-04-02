import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { unauthorized } from '../utils/response.js';

export function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized(res, 'Unauthorized');
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, config.jwt.accessSecret, (err, user) => {
    if (err) {
      return unauthorized(res, 'Unauthorized');
    }

    req.user = { id: user.sub };
    next();
  });
}
