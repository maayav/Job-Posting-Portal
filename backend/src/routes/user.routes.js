import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import * as reportController from '../controllers/report.controller.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/:userId/reports', reportController.getUserReports);

export default router;