import { verifyToken } from '../utils/tokens.js';
import { config } from '../config/index.js';
import { unauthorized } from '../utils/response.js';

export async function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized(res, 'Unauthorized');
  }

  const token = authHeader.split(' ')[1];

  try {
    const user = await verifyToken(token, config.jwt.accessSecret);
    req.user = { id: user.sub };
    next();
  } catch {
    return unauthorized(res, 'Unauthorized');
  }
}
