// authenticate the JWT

import jwt from 'jsonwebtoken';
import { config } from '../config';

export function authenticateJWT(req, res, next) {
  const  authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {

    return res.status(401).json({ status: false, error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, config.jwt.accessSecret, (err, user) => {
    if (err) {
      return res.status(401).json({ status: false, error: 'Unauthorized' });
    }

    req.user = {id : user.sub};
    next();
  });
}
