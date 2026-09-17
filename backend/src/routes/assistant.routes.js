import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import * as assistantController from '../controllers/assistant.controller.js';

const router = Router();
router.use(requireAuth);
router.get('/context', assistantController.getAssistantContext);
router.post('/chat', assistantController.chat);

export default router;
