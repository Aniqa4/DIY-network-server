import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
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
// revoked by logout, and puts the payload on req.user:
//   req.user = { userId, username, jti, exp }
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

  req.user = {
    userId: payload.sub,
    username: payload.username,
    jti: payload.jti,
    exp: payload.exp,
  };
  next();
}
