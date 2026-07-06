import { Router } from 'express';
import * as controller from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth';
import validate from '../middleware/validate';
import {
  registerSchema,
  loginSchema,
  resendVerificationSchema,
  verifyOtpSchema,
  requestOtpSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../validators/schemas';

const router = Router();

router.post('/register', validate(registerSchema), controller.register);
router.post('/login', validate(loginSchema), controller.login);
router.post('/verify-otp', validate(verifyOtpSchema), controller.verifyOtp);
router.post(
  '/resend-verification',
  validate(resendVerificationSchema),
  controller.resendVerification,
);
router.post(
  '/forgot-password',
  validate(requestOtpSchema),
  controller.forgotPassword,
);
router.post(
  '/reset-password',
  validate(resetPasswordSchema),
  controller.resetPassword,
);
router.post(
  '/change-password',
  requireAuth,
  validate(changePasswordSchema),
  controller.changePassword,
);
router.post('/logout', requireAuth, controller.logout);

router.get('/google', controller.googleLogin);
router.get('/google/callback', controller.googleCallback);

export default router;
