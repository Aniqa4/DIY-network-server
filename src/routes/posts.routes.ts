import { Router } from 'express';
import * as controller from '../controllers/posts.controller';
import { requireAuth } from '../middleware/auth';
import validate from '../middleware/validate';
import { postImages } from '../middleware/upload';
import { createPostSchema, updatePostSchema } from '../validators/schemas';

const router = Router();

router.get('/', controller.findAll);
router.get('/:id', controller.findOne);
router.post('/:id/view', controller.incrementView);

// upload middleware runs first so multer has parsed the multipart body
// before the zod schema validates it.
router.post(
  '/',
  requireAuth,
  postImages,
  validate(createPostSchema),
  controller.create,
);
// postImages (multer) runs first so multipart edits — which can include new
// image files — are parsed before validation. JSON-only edits pass straight
// through multer untouched.
router.patch(
  '/:id',
  requireAuth,
  postImages,
  validate(updatePostSchema),
  controller.update,
);
router.delete('/:id', requireAuth, controller.remove);

export default router;
