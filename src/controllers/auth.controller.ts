import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import prisma from '../lib/prisma';
import env from '../config/env';
import { issueOtp, consumeOtp } from '../lib/otp';
import ApiError from '../utils/api-error';

function signToken(userId: string, username: string) {
  const jti = randomUUID();
  const accessToken = jwt.sign({ sub: userId, username, jti }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
  return { accessToken };
}

// POST /auth/register
export async function register(req: Request, res: Response) {
  const { email: userEmail, username, password } = req.body;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: userEmail }, { username }] },
  });
  if (existing) {
    throw ApiError.conflict('Email or username already in use');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email: userEmail,
      username,
      password: hashedPassword,
    },
  });

  await issueOtp(user, 'VERIFY');

  res.status(201).json({
    message:
      'Registration successful. We emailed a 6-digit code to verify your account.',
  });
}

// POST /auth/login
export async function login(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { email: req.body.email },
  });
  if (!user || !user.password) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  const passwordMatches = await bcrypt.compare(
    req.body.password,
    user.password,
  );
  if (!passwordMatches) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  if (user.banned) {
    throw ApiError.forbidden('Your account has been suspended.');
  }

  if (!user.emailVerified) {
    // Auto-send a fresh code and signal the client to route to the OTP screen.
    await issueOtp(user, 'VERIFY');
    res.status(403).json({
      message: 'Email not verified. We emailed you a new 6-digit code.',
      code: 'EMAIL_NOT_VERIFIED',
    });
    return;
  }

  res.json(signToken(user.id, user.username));
}

// POST /auth/verify-otp — confirm an email with the 6-digit code, then log in.
export async function verifyOtp(req: Request, res: Response) {
  const { email: userEmail, code } = req.body;
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) {
    throw ApiError.badRequest('No active code — request a new one.');
  }

  await consumeOtp(user.id, 'VERIFY', code);

  if (!user.emailVerified) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });
  }

  res.json(signToken(user.id, user.username));
}

// POST /auth/resend-verification — reissue a verification code. Generic
// response so it can't be used to probe which emails are registered.
export async function resendVerification(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { email: req.body.email },
  });
  const genericResponse = {
    message:
      'If an account with that email exists and is unverified, a new code has been sent.',
  };

  if (user && !user.emailVerified) {
    await issueOtp(user, 'VERIFY');
  }
  res.json(genericResponse);
}

// POST /auth/forgot-password — email a reset code. Generic response to avoid
// email enumeration.
export async function forgotPassword(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { email: req.body.email },
  });
  // Google-only accounts (no password) can't reset — skip silently.
  if (user && user.password) {
    await issueOtp(user, 'RESET');
  }
  res.json({
    message:
      'If an account with that email exists, a password reset code has been sent.',
  });
}

// POST /auth/reset-password — verify the reset code and set a new password.
export async function resetPassword(req: Request, res: Response) {
  const { email: userEmail, code, newPassword } = req.body;
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) {
    throw ApiError.badRequest('No active code — request a new one.');
  }

  await consumeOtp(user.id, 'RESET', code);

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  res.json({ message: 'Password updated — you can now log in.' });
}

// POST /auth/change-password — authenticated password change. Users who
// already have a password must supply the current one; Google-only accounts
// setting a password for the first time may omit it.
export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = req.body;
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
  });
  if (!user) {
    throw ApiError.unauthorized();
  }

  if (user.password) {
    if (!currentPassword) {
      throw ApiError.badRequest('Current password is required.');
    }
    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) {
      throw ApiError.badRequest('Current password is incorrect.');
    }
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  res.json({ message: 'Password changed.' });
}

// POST /auth/logout — records the token's jti so it is rejected from now on.
export async function logout(req: Request, res: Response) {
  const { jti, exp } = req.user!;
  await prisma.revokedToken.create({
    data: { jti, expiresAt: new Date(exp * 1000) },
  });
  res.json({ message: 'Logged out' });
}

// -- Google OAuth (implemented with plain fetch, no passport) ---------------

// GET /auth/google — kicks off the OAuth redirect.
export function googleLogin(req: Request, res: Response) {
  if (!env.google.clientId || env.google.clientId === 'replace-me') {
    throw ApiError.badRequest(
      'Google OAuth is not configured on this server (set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).',
    );
  }
  const params = new URLSearchParams({
    client_id: env.google.clientId,
    redirect_uri: env.google.callbackUrl ?? '',
    response_type: 'code',
    scope: 'email profile',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

// GET /auth/google/callback — Google redirects the *browser* here with
// ?code=... . We exchange it for our own JWT, then redirect back to the
// frontend with the token in the URL so the SPA can store it. On any failure
// we bounce to the login page with an ?error flag instead of dumping JSON.
export async function googleCallback(req: Request, res: Response) {
  try {
    const code = req.query.code as string | undefined;
    if (!code) {
      throw new Error('Missing authorization code');
    }

    // Exchange the code for a Google access token.
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.google.clientId ?? '',
        client_secret: env.google.clientSecret ?? '',
        redirect_uri: env.google.callbackUrl ?? '',
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenResponse.ok) {
      throw new Error('Google token exchange failed');
    }
    const { access_token: googleAccessToken } =
      (await tokenResponse.json()) as { access_token: string };

    // Fetch the user's Google profile.
    const profileResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      { headers: { Authorization: `Bearer ${googleAccessToken}` } },
    );
    if (!profileResponse.ok) {
      throw new Error('Could not fetch Google profile');
    }
    const profile = (await profileResponse.json()) as {
      id: string;
      email?: string;
    };
    if (!profile.email) {
      throw new Error('Google account has no email');
    }

    const user = await findOrCreateGoogleUser({
      googleId: profile.id,
      email: profile.email,
    });

    const { accessToken } = signToken(user.id, user.username);
    res.redirect(`${env.clientUrl}/auth/callback?token=${accessToken}`);
  } catch (error) {
    console.error('Google OAuth callback failed:', error);
    res.redirect(`${env.clientUrl}/login?error=google`);
  }
}

async function findOrCreateGoogleUser({
  googleId,
  email: userEmail,
}: {
  googleId: string;
  email: string;
}) {
  const existingByGoogleId = await prisma.user.findUnique({
    where: { googleId },
  });
  if (existingByGoogleId) {
    return existingByGoogleId;
  }

  const existingByEmail = await prisma.user.findUnique({
    where: { email: userEmail },
  });
  if (existingByEmail) {
    // A manually-registered account is signing in with Google for the
    // first time — link the accounts instead of creating a duplicate.
    return prisma.user.update({
      where: { id: existingByEmail.id },
      data: { googleId, emailVerified: true },
    });
  }

  const username = await generateUniqueUsername(userEmail);
  return prisma.user.create({
    data: {
      email: userEmail,
      username,
      googleId,
      emailVerified: true, // Google has already verified this address.
    },
  });
}

async function generateUniqueUsername(userEmail: string) {
  const base = userEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') || 'user';
  let candidate = base;
  let suffix = 0;
  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
  return candidate;
}
