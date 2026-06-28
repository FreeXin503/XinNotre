import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
import { config } from '../config/index.js';
import { success, fail, asyncHandler } from '../utils/response.js';

const JWT_SECRET = config.jwtSecret;

export const register = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  // Check if user exists
  const userCheck = await query('SELECT id FROM users WHERE username = ?', [username]);
  if (userCheck.rows.length > 0) {
    return fail(res, 'Username already exists', 400);
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // Save user
  const insertResult = await query(
    'INSERT INTO users (username, password_hash) VALUES (?, ?)',
    [username, passwordHash]
  );

  const insertId = insertResult.rows.insertId;
  const userRes = await query('SELECT id, username FROM users WHERE id = ?', [insertId]);
  const user = userRes.rows[0];

  success(res, { user }, 201);
});

export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  // Get user
  const result = await query('SELECT * FROM users WHERE username = ?', [username]);
  if (result.rows.length === 0) {
    return fail(res, 'Invalid username or password', 401);
  }

  const user = result.rows[0];
  // Check password
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    return fail(res, 'Invalid username or password', 401);
  }

  // Sign JWT token
  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: '7d'
  });

  success(res, { token, user: { id: user.id, username: user.username } });
});
