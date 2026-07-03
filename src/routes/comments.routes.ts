import { Router } from 'express';
import * as controller from '../controllers/comments.controller';
import { requireAuth } from '../middleware/auth';
import validate from '../middleware/validate';
import { createCommentSchema } from '../validators/schemas';

const router = Router();

router.get('/', controller.findForPost);
router.post('/', requireAuth, validate(createCommentSchema), controller.create);
router.delete('/:id', requireAuth, controller.remove);

export default router;
