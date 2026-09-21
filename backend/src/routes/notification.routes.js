import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import * as notificationController from '../controllers/notification.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', notificationController.listNotifications);
router.patch('/:id/read', notificationController.markNotificationRead);
router.post('/read-all', notificationController.markAllNotificationsRead);

export default router;