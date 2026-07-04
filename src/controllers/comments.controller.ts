import type { Request, Response } from 'express';
import prisma from '../lib/prisma';
import * as notifications from '../services/notifications.service';
import ApiError from '../utils/api-error';

// GET /comments?postId=xxx
export async function findForPost(req: Request, res: Response) {
  const comments = await prisma.comment.findMany({
    where: { postId: req.query.postId as string | undefined },
    orderBy: { createdAt: 'asc' },
    include: { author: { select: { id: true, username: true } } },
  });
  res.json(comments);
}

// POST /comments
export async function create(req: Request, res: Response) {
  const { postId, content } = req.body;
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    throw ApiError.notFound('Post not found');
  }
  const comment = await prisma.comment.create({
    data: { content, postId, authorId: req.user!.userId },
    include: { author: { select: { id: true, username: true } } },
  });
  await notifications.notify({
    type: 'COMMENT',
    recipientId: post.authorId,
    actorId: req.user!.userId,
    postId,
  });
  res.status(201).json(comment);
}

// DELETE /comments/:id
export async function remove(req: Request<{ id: string }>, res: Response) {
  const comment = await prisma.comment.findUnique({
    where: { id: req.params.id },
  });
  if (!comment) {
    throw ApiError.notFound('Comment not found');
  }
  if (comment.authorId !== req.user!.userId) {
    throw ApiError.forbidden('You do not own this comment');
  }
  await prisma.comment.delete({ where: { id: req.params.id } });
  res.json({ message: 'Comment deleted' });
}
