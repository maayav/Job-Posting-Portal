import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireReportAccess, requireOwnership } from '../middleware/ownership.middleware.js';
import { ProfileSubmission } from '../models/profileSubmission.js';
import { analyzeLimiter } from '../middleware/rateLimit.middleware.js';
import * as analyzeController from '../controllers/analyze.controller.js';

const router = Router();

router.use(requireAuth);

router.post('/', analyzeLimiter, analyzeController.createAnalysis);
router.get('/submission/:id/status', requireOwnership(ProfileSubmission), analyzeController.getSubmissionAnalysisStatus);
router.get('/:id/status', requireReportAccess, analyzeController.getAnalysisStatus);

export default router;
