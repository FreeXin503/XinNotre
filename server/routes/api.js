/**
 * API 路由聚合器
 * 子路由按域名拆分到各文件，此处统一挂载。
 */
import { Router } from 'express';

import authRoutes from './auth.js';
import noteRoutes from './notes.js';
import syncRoutes from './sync.js';
import aiRoutes from './ai.js';
import skillRoutes from './skills.js';
import reportRoutes from './report.js';
import emotionRoutes from './emotion.js';
import keyRoutes from './keys.js';
import tagRoutes from './tags.js';       // mixed prefix: /tags + /notes/:noteId/tags
import kbRoutes from './knowledgeBases.js';
import archaeologyRoutes from './archaeology.js';
import personaRoutes from './persona.js';
import weatherRoutes from './emotionWeather.js';   // mixed prefix: /annotation + /weather
import almanacRoutes from './almanac.js';
import letterRoutes from './letter.js';          // mixed prefix: /letter + /letters
import nightLetterRoutes from './nightLetter.js';
import penpalRoutes from './penpal.js';
import memoirRoutes from './memoir.js';
import growthRoutes from './growthTree.js';      // mixed prefix: /goal + /goals
import spectrumRoutes from './thoughtSpectrum.js';
import cosmosRoutes from './cosmos.js';
import galaxyRoutes from './mindGalaxy.js';
import importRoutes from './import.js';
import { createShareToken, getSharedSnapshot } from '../controllers/shareController.js';
import authMiddleware from '../middleware/auth.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/notes', noteRoutes);
router.use('/sync', syncRoutes);
router.use('/ai', aiRoutes);
router.use('/skills', skillRoutes);
router.use('/report', reportRoutes);
router.use('/emotion', emotionRoutes);
router.use('/keys', keyRoutes);
router.use('/knowledge-bases', kbRoutes);
router.use('/archaeology', archaeologyRoutes);
router.use('/persona', personaRoutes);
router.use('/almanac', almanacRoutes);
router.use('/night-letters', nightLetterRoutes);
router.use('/penpal', penpalRoutes);
router.use('/memoir', memoirRoutes);
router.use('/thought-spectrum', spectrumRoutes);
router.use('/cosmos', cosmosRoutes);
router.use('/mind-galaxy', galaxyRoutes);
router.use('/import', importRoutes);
router.post('/share', authMiddleware, createShareToken);
router.get('/share/:token', getSharedSnapshot);

// Sub-routers with mixed prefixes mount at root
router.use('/', tagRoutes);
router.use('/', weatherRoutes);
router.use('/', letterRoutes);
router.use('/', growthRoutes);

export default router;
