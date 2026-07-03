import { Router } from 'express';
import * as controller from '../controllers/users.controller';
import { requireAuth } from '../middleware/auth';
import validate from '../middleware/validate';
import { avatar } from '../middleware/upload';
import { updateUserSchema } from '../validators/schemas';

const router = Router();

// NOTE: 'me' routes must come before ':id' routes so Express doesn't treat
// the literal word "me" as an :id value.
router.get('/me', requireAuth, controller.findMe);
router.patch('/me', requireAuth, validate(updateUserSchema), controller.updateMe);
router.delete('/me', requireAuth, controller.removeMe);
router.post('/me/avatar', requireAuth, avatar, controller.uploadAvatar);

router.get('/:id', controller.findOne);

export default router;
