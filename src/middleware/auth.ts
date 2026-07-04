import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import prisma from '../lib/prisma';
import env from '../config/env';
import ApiError from '../utils/api-error';

interface TokenPayload extends jwt.JwtPayload {
  sub: string;
  username: string;
  jti: string;
  exp: number;
}

// Protects a route. Verifies the Bearer token, rejects tokens that were
// revoked by logout, blocks banned accounts, and loads the user's current
// role so downstream role checks see live values:
//   req.user = { userId, username, jti, exp, role }
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized();
  }

  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, env.jwtSecret) as TokenPayload;
  } catch {
    throw ApiError.unauthorized();
  }

  const revoked = await prisma.revokedToken.findUnique({
    where: { jti: payload.jti },
  });
  if (revoked) {
    throw ApiError.unauthorized('This token has been logged out');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { role: true, banned: true },
  });
  if (!user) {
    throw ApiError.unauthorized();
  }
  if (user.banned) {
    throw ApiError.forbidden('Your account has been suspended');
  }

  req.user = {
    userId: payload.sub,
    username: payload.username,
    jti: payload.jti,
    exp: payload.exp,
    role: user.role,
  };
  next();
}

// Gate a route to specific roles. Assumes requireAuth ran first.
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw ApiError.forbidden('You do not have permission to do that');
    }
    next();
  };
}

// Admins + moderators (the staff team).
export const requireStaff = requireRole('ADMIN', 'MODERATOR');
// Admins only.
export const requireAdmin = requireRole('ADMIN');
