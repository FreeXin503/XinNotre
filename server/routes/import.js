import { Router } from 'express';
import multer from 'multer';
import authMiddleware from '../middleware/auth.js';
import { importDayOne, importNotion, importObsidian, importEvernote, importFeishu } from '../controllers/importController.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const u = upload.single('file');

router.post('/dayone', authMiddleware, u, importDayOne);
router.post('/notion', authMiddleware, u, importNotion);
router.post('/obsidian', authMiddleware, u, importObsidian);
router.post('/evernote', authMiddleware, u, importEvernote);
router.post('/feishu', authMiddleware, u, importFeishu);

export default router;
