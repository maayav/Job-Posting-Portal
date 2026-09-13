import { Router } from 'express';
import { ProfileSubmission } from '../models/profileSubmission.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireOwnership } from '../middleware/ownership.middleware.js';
import { uploadResume, validateResumeFile } from '../middleware/upload.middleware.js';
import * as profileController from '../controllers/profile.controller.js';

const router = Router();

router.use(requireAuth);

router.post(
  '/',
  uploadResume,
  validateResumeFile,
  profileController.createProfile
);

router.get(
  '/:id',
  requireOwnership(ProfileSubmission),
  profileController.getProfile
);

router.delete(
  '/:id',
  requireOwnership(ProfileSubmission),
  profileController.deleteProfile
);

export default router;