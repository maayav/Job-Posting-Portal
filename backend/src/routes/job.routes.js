import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import * as jobController from '../controllers/job.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', jobController.listJobs);
router.post('/', requireRole('admin'), jobController.createJob);
router.put('/:id', requireRole('admin'), jobController.updateJob);
router.delete('/:id', requireRole('admin'), jobController.deleteJob);

export default router;