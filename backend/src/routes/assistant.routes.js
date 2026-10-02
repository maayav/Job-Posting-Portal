import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { assistantLimiter } from '../middleware/rateLimit.middleware.js';
import * as assistantController from '../controllers/assistant.controller.js';

const router = Router();
router.use(requireAuth);
router.get('/context', assistantController.getAssistantContext);
router.post('/chat', assistantLimiter, assistantController.chat);

export default router;
