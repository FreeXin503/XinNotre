import { Router } from 'express';
import multer from 'multer';
import authMiddleware from '../middleware/auth.js';
import { importDayOne, importNotion, importObsidian, importEvernote, importFeishu, importChatlog, importVoice } from '../controllers/importController.js';

const router = Router();

const upload10 = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const upload25 = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const u10 = upload10.single('file');
const u25 = upload25.single('file');

router.post('/dayone', authMiddleware, u10, importDayOne);
router.post('/notion', authMiddleware, u10, importNotion);
router.post('/obsidian', authMiddleware, u10, importObsidian);
router.post('/evernote', authMiddleware, u10, importEvernote);
router.post('/feishu', authMiddleware, u10, importFeishu);
router.post('/chatlog', authMiddleware, u10, importChatlog);
router.post('/voice', authMiddleware, u25, importVoice);

export default router;
