import { Router } from 'express';
import * as controller from '../controllers/saves.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/mine', requireAuth, controller.findMine);
router.post('/:postId', requireAuth, controller.toggle);

export default router;
