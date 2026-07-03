import { Router } from 'express';
import * as controller from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth';
import validate from '../middleware/validate';
import {
  registerSchema,
  loginSchema,
  resendVerificationSchema,
} from '../validators/schemas';

const router = Router();

router.post('/register', validate(registerSchema), controller.register);
router.post('/login', validate(loginSchema), controller.login);
router.get('/verify-email', controller.verifyEmail);
router.post(
  '/resend-verification',
  validate(resendVerificationSchema),
  controller.resendVerification,
);
router.post('/logout', requireAuth, controller.logout);

router.get('/google', controller.googleLogin);
router.get('/google/callback', controller.googleCallback);

export default router;
