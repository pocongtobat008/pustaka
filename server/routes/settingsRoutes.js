import express from 'express';
import { getAiSettings, saveAiSettings, listAiModels, testAiSettings, verifyAiModels } from '../controllers/settingsController.js';
import { checkAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/settings/ai', checkAuth, getAiSettings);
router.put('/settings/ai', checkAuth, saveAiSettings);
router.get('/settings/ai/models', checkAuth, listAiModels);
router.post('/settings/ai/test', checkAuth, testAiSettings);
router.post('/settings/ai/models/verify', checkAuth, verifyAiModels);

export default router;
