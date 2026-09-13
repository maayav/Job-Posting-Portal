import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireReportAccess } from '../middleware/ownership.middleware.js';
import * as reportController from '../controllers/report.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/:id', requireReportAccess, reportController.getReport);
router.patch('/:id/study-plan/:itemId', reportController.markStudyPlanItemDone);

export default router;