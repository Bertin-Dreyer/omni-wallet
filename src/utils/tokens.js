import jwt from 'jsonwebtoken'
import { config } from '../config/index.js'

export function generateTokens(userId) {
  const accessToken = jwt.sign(
    {
      sub: userId,
    },
    config.jwt.accessSecret,
    {
      expiresIn: config.jwt.accessExpiresIn,
    }
  );

  const refreshToken = jwt.sign(
    {
      sub: userId,
    },
    config.jwt.refreshSecret,
    {
      expiresIn: config.jwt.refreshExpiresIn,
    }
  );

  return { accessToken, refreshToken };
}

// Verify Token
export function verifyToken(token, secret) {
  return jwt.verify(token, secret);
}
