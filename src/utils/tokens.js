import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/index.js';

export function generateTokens(userId) {
  const accessToken = jwt.sign(
    { sub: userId },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiresIn }
  );

  const refreshToken = jwt.sign(
    { sub: userId },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );

  return { accessToken, refreshToken };
}

export function verifyToken(token, secret) {
  return jwt.verify(token, secret);
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
