import type { Request, Response } from 'express';
import prisma from '../lib/prisma';
import * as notifications from '../services/notifications.service';
import ApiError from '../utils/api-error';

const SAFE_SELECT = { id: true, username: true, avatarUrl: true } as const;

// GET /likes/:postId — anyone can see who liked a post.
export async function findLikers(
  req: Request<{ postId: string }>,
  res: Response,
) {
  const rows = await prisma.like.findMany({
    where: { postId: req.params.postId },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: SAFE_SELECT } },
  });
  res.json(rows.map((row) => row.user));
}

// POST /likes/:postId — toggling is the common UX for a "like" button:
// call it once to like, call it again to unlike.
export async function toggle(
  req: Request<{ postId: string }>,
  res: Response,
) {
  const postId = req.params.postId;
  const userId = req.user!.userId;

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    throw ApiError.notFound('Post not found');
  }

  const existing = await prisma.like.findUnique({
    where: { userId_postId: { userId, postId } },
  });

  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
    res.json({ liked: false });
    return;
  }

  await prisma.like.create({ data: { userId, postId } });
  await notifications.notify({
    type: 'LIKE',
    recipientId: post.authorId,
    actorId: userId,
    postId,
  });
  res.json({ liked: true });
}
