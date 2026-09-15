import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import * as roleController from '../controllers/role.controller.js';

const router = Router();

router.get('/', requireAuth, roleController.listRoles);

export default router;