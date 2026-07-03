import type { Request, Response } from 'express';
import prisma from '../lib/prisma';
import * as cloudinary from '../lib/cloudinary';
import ApiError from '../utils/api-error';

const PUBLIC_SELECT = {
  id: true,
  username: true,
  avatarUrl: true,
  bio: true,
  createdAt: true,
  _count: { select: { posts: true } },
} as const;

const ME_SELECT = { ...PUBLIC_SELECT, email: true } as const;

// GET /users/me
export async function findMe(req: Request, res: Response) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.userId },
    select: ME_SELECT,
  });
  res.json(user);
}

// PATCH /users/me
export async function updateMe(req: Request, res: Response) {
  if (req.body.username) {
    const existing = await prisma.user.findUnique({
      where: { username: req.body.username },
    });
    if (existing && existing.id !== req.user!.userId) {
      throw ApiError.conflict('Username already taken');
    }
  }
  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: req.body,
    select: ME_SELECT,
  });
  res.json(user);
}

// DELETE /users/me
export async function removeMe(req: Request, res: Response) {
  await prisma.user.delete({ where: { id: req.user!.userId } });
  res.status(204).end();
}

// POST /users/me/avatar (multipart, field "avatar")
export async function uploadAvatar(req: Request, res: Response) {
  if (!req.file) {
    throw ApiError.badRequest('An "avatar" image file is required');
  }
  const result = await cloudinary.uploadImage(req.file, 'avatars');
  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: { avatarUrl: result.secure_url },
    select: ME_SELECT,
  });
  res.json(user);
}

// GET /users/:id — public profile.
export async function findOne(req: Request<{ id: string }>, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: PUBLIC_SELECT,
  });
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  res.json(user);
}
