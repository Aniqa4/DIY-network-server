import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes, randomUUID } from 'crypto';
import prisma from '../lib/prisma';
import env from '../config/env';
import * as email from '../lib/email';
import ApiError from '../utils/api-error';

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function signToken(userId: string, username: string) {
  const jti = randomUUID();
  const accessToken = jwt.sign({ sub: userId, username, jti }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
  return { accessToken };
}

async function sendVerificationEmailSafe(to: string, token: string) {
  try {
    await email.sendVerificationEmail(to, token);
  } catch (error) {
    // Don't let a broken SMTP config block signups — the user can always
    // request a fresh link via /auth/resend-verification.
    console.error('Failed to send verification email:', error);
  }
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
  const verificationToken = randomBytes(32).toString('hex');

  const user = await prisma.user.create({
    data: {
      email: userEmail,
      username,
      password: hashedPassword,
      verificationToken,
      verificationTokenExpiresAt: new Date(
        Date.now() + VERIFICATION_TOKEN_TTL_MS,
      ),
    },
  });

  await sendVerificationEmailSafe(user.email, verificationToken);

  res.status(201).json({
    message:
      'Registration successful. Check your email to verify your account before logging in.',
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

  if (!user.emailVerified) {
    throw ApiError.forbidden(
      'Please verify your email before logging in. Check your inbox, or request a new link from /auth/resend-verification.',
    );
  }

  res.json(signToken(user.id, user.username));
}

// GET /auth/verify-email?token=...
export async function verifyEmail(req: Request, res: Response) {
  const token = req.query.token as string | undefined;
  const user = token
    ? await prisma.user.findUnique({ where: { verificationToken: token } })
    : null;
  if (!user || !user.verificationTokenExpiresAt) {
    throw ApiError.badRequest('Invalid or expired verification link');
  }
  if (user.verificationTokenExpiresAt < new Date()) {
    throw ApiError.badRequest(
      'Verification link has expired. Request a new one from /auth/resend-verification.',
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpiresAt: null,
    },
  });

  res.json({ message: 'Email verified — you can now log in.' });
}

// POST /auth/resend-verification
export async function resendVerification(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { email: req.body.email },
  });
  // Always respond the same way whether or not the account exists, so this
  // endpoint can't be used to test which emails are registered.
  const genericResponse = {
    message:
      'If an account with that email exists and is unverified, a new verification link has been sent.',
  };

  if (!user || user.emailVerified) {
    res.json(genericResponse);
    return;
  }

  const verificationToken = randomBytes(32).toString('hex');
  await prisma.user.update({
    where: { id: user.id },
    data: {
      verificationToken,
      verificationTokenExpiresAt: new Date(
        Date.now() + VERIFICATION_TOKEN_TTL_MS,
      ),
    },
  });
  await sendVerificationEmailSafe(user.email, verificationToken);

  res.json(genericResponse);
}

// POST /auth/logout — records the token's jti so it is rejected from now on.
export async function logout(req: Request, res: Response) {
  const { jti, exp } = req.user!;
  await prisma.revokedToken.create({
    data: { jti, expiresAt: new Date(exp * 1000) },
  });
  res.status(204).end();
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

// GET /auth/google/callback — Google redirects back here with ?code=...
export async function googleCallback(req: Request, res: Response) {
  const code = req.query.code as string | undefined;
  if (!code) {
    throw ApiError.badRequest('Missing authorization code');
  }

  // Exchange the code for an access token.
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
    throw ApiError.unauthorized('Google token exchange failed');
  }
  const { access_token: googleAccessToken } = (await tokenResponse.json()) as {
    access_token: string;
  };

  // Fetch the user's Google profile.
  const profileResponse = await fetch(
    'https://www.googleapis.com/oauth2/v2/userinfo',
    { headers: { Authorization: `Bearer ${googleAccessToken}` } },
  );
  if (!profileResponse.ok) {
    throw ApiError.unauthorized('Could not fetch Google profile');
  }
  const profile = (await profileResponse.json()) as {
    id: string;
    email?: string;
  };
  if (!profile.email) {
    throw ApiError.badRequest('Google account has no email');
  }

  const user = await findOrCreateGoogleUser({
    googleId: profile.id,
    email: profile.email,
  });

  res.json(signToken(user.id, user.username));
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
