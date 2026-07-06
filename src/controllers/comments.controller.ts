import type { Request, Response } from 'express';
import prisma from '../lib/prisma';
import * as notifications from '../services/notifications.service';
import ApiError from '../utils/api-error';

const authorSelect = {
  author: { select: { id: true, username: true, avatarUrl: true } },
} as const;

// GET /comments?postId=xxx — top-level comments with their replies nested.
export async function findForPost(req: Request, res: Response) {
  const comments = await prisma.comment.findMany({
    where: { postId: req.query.postId as string | undefined, parentId: null },
    orderBy: { createdAt: 'asc' },
    include: {
      ...authorSelect,
      replies: {
        orderBy: { createdAt: 'asc' },
        include: authorSelect,
      },
    },
  });
  res.json(comments);
}

// POST /comments — a top-level comment, or a reply when parentId is given.
export async function create(req: Request, res: Response) {
  const { postId, content } = req.body;
  let parentId: string | undefined = req.body.parentId;
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    throw ApiError.notFound('Post not found');
  }

  let parent = null;
  if (parentId) {
    parent = await prisma.comment.findUnique({ where: { id: parentId } });
    if (!parent || parent.postId !== postId) {
      throw ApiError.badRequest('Parent comment not found on this post');
    }
    // Flatten to a single level: a reply to a reply attaches to the top-level.
    if (parent.parentId) {
      parentId = parent.parentId;
    }
  }

  const comment = await prisma.comment.create({
    data: { content, postId, parentId: parentId ?? null, authorId: req.user!.userId },
    include: authorSelect,
  });

  // Notify the post author (for a top-level comment) or the parent comment's
  // author (for a reply). Never self-notify (handled inside notify()).
  await notifications.notify({
    type: 'COMMENT',
    recipientId: parent ? parent.authorId : post.authorId,
    actorId: req.user!.userId,
    postId,
  });
  res.status(201).json(comment);
}

// PATCH /comments/:id — edit your own comment or reply.
export async function update(req: Request<{ id: string }>, res: Response) {
  const comment = await prisma.comment.findUnique({
    where: { id: req.params.id },
  });
  if (!comment) {
    throw ApiError.notFound('Comment not found');
  }
  if (comment.authorId !== req.user!.userId) {
    throw ApiError.forbidden('You do not own this comment');
  }
  const updated = await prisma.comment.update({
    where: { id: req.params.id },
    data: { content: req.body.content },
    include: authorSelect,
  });
  res.json(updated);
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
