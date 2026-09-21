import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { uploadApplicationResume, validateOptionalResumeFile } from '../middleware/upload.middleware.js';
import * as applicationController from '../controllers/application.controller.js';

const router = Router();

router.use(requireAuth);

router.post(
  '/',
  requireRole('student'),
  uploadApplicationResume,
  validateOptionalResumeFile,
  applicationController.applyToJob
);
router.get('/me', applicationController.listMyApplications);
router.get('/:applicationId/resume', applicationController.getApplicationResume);

export default router;