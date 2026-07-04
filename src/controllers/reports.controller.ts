import type { Request, Response } from 'express';
import prisma from '../lib/prisma';
import ApiError from '../utils/api-error';

const REPORTER_SELECT = { id: true, username: true, avatarUrl: true } as const;

// POST /reports — any logged-in user reports a post or another profile.
export async function create(req: Request, res: Response) {
  const { postId, reportedUserId, reason } = req.body as {
    postId?: string;
    reportedUserId?: string;
    reason: string;
  };

  if (postId) {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw ApiError.notFound('Post not found');
  } else if (reportedUserId) {
    if (reportedUserId === req.user!.userId) {
      throw ApiError.badRequest('You cannot report yourself');
    }
    const user = await prisma.user.findUnique({ where: { id: reportedUserId } });
    if (!user) throw ApiError.notFound('User not found');
  }

  await prisma.report.create({
    data: {
      reason,
      reporterId: req.user!.userId,
      postId: postId ?? null,
      reportedUserId: reportedUserId ?? null,
    },
  });

  res.status(201).json({ message: 'Report submitted. Thanks for flagging this.' });
}

// GET /admin/reports?status=PENDING — staff view of all reports, newest first.
export async function findAll(req: Request, res: Response) {
  const status = req.query.status as 'PENDING' | 'RESOLVED' | 'DISMISSED' | undefined;
  const reports = await prisma.report.findMany({
    where: { status: status || undefined },
    orderBy: { createdAt: 'desc' },
    include: {
      reporter: { select: REPORTER_SELECT },
      post: {
        select: { id: true, title: true, banned: true, authorId: true },
      },
      reportedUser: {
        select: { id: true, username: true, avatarUrl: true, banned: true },
      },
    },
  });
  res.json(reports);
}

// PATCH /admin/reports/:id — mark a report RESOLVED or DISMISSED.
export async function resolve(req: Request<{ id: string }>, res: Response) {
  const report = await prisma.report.findUnique({ where: { id: req.params.id } });
  if (!report) throw ApiError.notFound('Report not found');

  const updated = await prisma.report.update({
    where: { id: req.params.id },
    data: { status: req.body.status },
  });
  res.json(updated);
}
