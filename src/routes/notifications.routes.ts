import { Router } from 'express';
import * as controller from '../controllers/notifications.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/', controller.findMine);
router.patch('/:id/read', controller.markRead);
router.post('/read-all', controller.markAllRead);

export default router;
