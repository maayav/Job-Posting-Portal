import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import * as applicationController from '../controllers/application.controller.js';

const router = Router();

router.use(requireAuth);

router.post('/', requireRole('student'), applicationController.applyToJob);
router.get('/me', applicationController.listMyApplications);

export default router;