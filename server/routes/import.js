import { Router } from 'express';
import multer from 'multer';
import authMiddleware from '../middleware/auth.js';
import { importDayOne } from '../controllers/importController.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.post('/dayone', authMiddleware, upload.single('file'), importDayOne);

export default router;
