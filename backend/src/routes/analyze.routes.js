import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireReportAccess } from '../middleware/ownership.middleware.js';
import { analyzeLimiter } from '../middleware/rateLimit.middleware.js';
import * as analyzeController from '../controllers/analyze.controller.js';

const router = Router();

router.use(requireAuth);

router.post('/', analyzeLimiter, analyzeController.createAnalysis);
router.get('/:id/status', requireReportAccess, analyzeController.getAnalysisStatus);

export default router;