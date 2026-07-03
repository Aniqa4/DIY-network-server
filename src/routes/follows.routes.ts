import { Router } from 'express';
import * as controller from '../controllers/follows.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/:userId', requireAuth, controller.toggle);
router.get('/:userId/followers', controller.getFollowers);
router.get('/:userId/following', controller.getFollowing);

export default router;
