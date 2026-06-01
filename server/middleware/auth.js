import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'xinnote_super_secret_jwt_key_2026';

export default function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Auth failed: Token missing or invalid structure' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.userId, username: decoded.username };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Auth failed: Token is expired or invalid' });
  }
}
