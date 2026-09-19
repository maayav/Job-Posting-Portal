import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import * as applicationController from '../controllers/application.controller.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/applications', applicationController.listAllApplications);
router.get('/applications/:applicationId', applicationController.getApplicationDetails);
router.get('/applications/:applicationId/resume', applicationController.getApplicationResume);
router.patch('/applications/:applicationId/status', applicationController.updateApplicationStatus);
router.get('/dashboard', applicationController.adminDashboard);
router.get('/dashboard/application-summary', applicationController.applicationSummary);

export default router;
