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

const ME_SELECT = { ...PUBLIC_SELECT, email: true, role: true } as const;

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
  const userId = req.user!.userId;

  // Gather every image the account owns before the cascade delete wipes the
  // rows: the avatar plus all images across the user's posts.
  const [me, posts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    }),
    prisma.post.findMany({
      where: { authorId: userId },
      select: { images: true },
    }),
  ]);

  await prisma.user.delete({ where: { id: userId } });

  const urls = [
    ...(me?.avatarUrl ? [me.avatarUrl] : []),
    ...posts.flatMap((post) => post.images),
  ];
  await Promise.all(urls.map((url) => cloudinary.destroyImage(url)));

  res.status(204).end();
}

// POST /users/me/avatar (multipart, field "avatar")
export async function uploadAvatar(req: Request, res: Response) {
  if (!req.file) {
    throw ApiError.badRequest('An "avatar" image file is required');
  }

  // Remember the current avatar so we can delete it once the new one is saved.
  const before = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { avatarUrl: true },
  });

  const result = await cloudinary.uploadImage(req.file, 'avatars');
  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: { avatarUrl: result.secure_url },
    select: ME_SELECT,
  });

  // Free the previous avatar (best-effort; skips non-Cloudinary URLs like
  // Google profile pictures, which destroyImage ignores).
  if (before?.avatarUrl) {
    await cloudinary.destroyImage(before.avatarUrl);
  }

  res.json(user);
}

// GET /users/:id — public profile. Banned profiles are hidden.
export async function findOne(req: Request<{ id: string }>, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { ...PUBLIC_SELECT, banned: true },
  });
  if (!user || user.banned) {
    throw ApiError.notFound('User not found');
  }
  const { banned, ...publicProfile } = user;
  res.json(publicProfile);
}
