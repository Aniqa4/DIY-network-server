import { Router } from 'express';
import * as controller from '../controllers/likes.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/:postId', controller.findLikers);
router.post('/:postId', requireAuth, controller.toggle);

export default router;
