import { randomInt } from 'crypto';
import bcrypt from 'bcryptjs';
import type { OtpPurpose } from '@prisma/client';
import prisma from './prisma';
import * as email from './email';
import ApiError from '../utils/api-error';

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

// Generates a 6-digit code, stores it hashed (one active row per user+purpose),
// and emails it. Best-effort send — a broken SMTP config must not break the
// flow, so send failures are swallowed (the code is logged in dev).
export async function issueOtp(
  user: { id: string; email: string },
  purpose: OtpPurpose,
) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await prisma.emailOtp.upsert({
    where: { userId_purpose: { userId: user.id, purpose } },
    create: { userId: user.id, purpose, codeHash, expiresAt },
    update: { codeHash, expiresAt, attempts: 0, createdAt: new Date() },
  });

  try {
    await email.sendOtpEmail(user.email, code, purpose, OTP_TTL_MINUTES);
  } catch (error) {
    console.error(`Failed to send ${purpose} OTP email:`, error);
  }
}

// Validates a submitted code for a user+purpose. Throws ApiError on any
// failure (missing/expired/too many attempts/mismatch). On success the row is
// consumed (deleted) and the function resolves.
export async function consumeOtp(
  userId: string,
  purpose: OtpPurpose,
  code: string,
) {
  const otp = await prisma.emailOtp.findUnique({
    where: { userId_purpose: { userId, purpose } },
  });
  if (!otp) {
    throw ApiError.badRequest('No active code — request a new one.');
  }
  if (otp.expiresAt < new Date()) {
    await prisma.emailOtp.delete({ where: { id: otp.id } });
    throw ApiError.badRequest('Code has expired — request a new one.');
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    await prisma.emailOtp.delete({ where: { id: otp.id } });
    throw ApiError.badRequest('Too many attempts — request a new code.');
  }

  const matches = await bcrypt.compare(code, otp.codeHash);
  if (!matches) {
    await prisma.emailOtp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    throw ApiError.badRequest('Incorrect code.');
  }

  await prisma.emailOtp.delete({ where: { id: otp.id } });
}
