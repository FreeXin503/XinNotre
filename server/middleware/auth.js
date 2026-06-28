import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { fail } from '../utils/response.js';

const JWT_SECRET = config.jwtSecret;

export default function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return fail(res, 'Auth failed: Token missing or invalid structure', 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.userId, username: decoded.username };
    next();
  } catch (err) {
    return fail(res, 'Auth failed: Token is expired or invalid', 401);
  }
}
