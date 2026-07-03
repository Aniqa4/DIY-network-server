import type { Request, Response } from 'express';
import prisma from '../lib/prisma';
import ApiError from '../utils/api-error';

// GET /saves/mine — the current user's bookmarks, newest first.
export async function findMine(req: Request, res: Response) {
  const saves = await prisma.save.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: 'desc' },
    include: { post: true },
  });
  res.json(saves);
}

// POST /saves/:postId — toggle save/unsave.
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

  const existing = await prisma.save.findUnique({
    where: { userId_postId: { userId, postId } },
  });

  if (existing) {
    await prisma.save.delete({ where: { id: existing.id } });
    res.json({ saved: false });
    return;
  }

  await prisma.save.create({ data: { userId, postId } });
  res.json({ saved: true });
}
