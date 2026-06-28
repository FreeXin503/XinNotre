import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login } from '../controllers/authController.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/register', authLimiter, validate('login'), register);
router.post('/login', authLimiter, validate('login'), login);

export default router;
