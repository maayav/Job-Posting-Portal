import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import * as skillController from '../controllers/skill.controller.js';

const router = Router();

router.get('/', requireAuth, skillController.listSkills);

export default router;
