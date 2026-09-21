import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import * as wishlistController from '../controllers/wishlist.controller.js';

const router = Router();

router.use(requireAuth, requireRole('student'));

router.get('/', wishlistController.listWishlist);
router.post('/', wishlistController.addToWishlist);
router.delete('/:jobId', wishlistController.removeFromWishlist);

export default router;