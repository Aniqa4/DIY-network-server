import { Router } from 'express';
import * as controller from '../controllers/messages.controller';
import { requireAuth } from '../middleware/auth';
import validate from '../middleware/validate';
import { createMessageSchema } from '../validators/schemas';

const router = Router();

router.use(requireAuth);

router.get('/', controller.inbox);
router.get('/:userId', controller.conversation);
router.post('/', validate(createMessageSchema), controller.send);

export default router;
