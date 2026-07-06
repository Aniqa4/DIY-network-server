import type { Request, Response } from 'express';
import prisma from '../lib/prisma';
import ApiError from '../utils/api-error';
import { parsePageParams, buildPage } from '../lib/pagination';

// GET /notifications[?page&limit] — the current user's notifications with the
// actor users resolved, so the UI can render "Alice and 3 others liked your
// post". Paginates only when ?page is supplied (the bell dropdown fetches the
// full list; a "see all" page can paginate).
export async function findMine(req: Request, res: Response) {
  const where = { recipientId: req.user!.userId };
  const paginate = req.query.page !== undefined;
  const params = parsePageParams(req);

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: { post: { select: { id: true, title: true } } },
      ...(paginate ? { skip: params.skip, take: params.limit } : {}),
    }),
    paginate ? prisma.notification.count({ where }) : Promise.resolve(0),
  ]);

  const actorIds = [...new Set(notifications.flatMap((n) => n.actorIds))];
  const actors = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, username: true, avatarUrl: true },
  });
  const actorsById = new Map(actors.map((actor) => [actor.id, actor]));

  const mapped = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    read: n.read,
    post: n.post,
    actors: n.actorIds
      .map((id) => actorsById.get(id))
      .filter((actor) => actor !== undefined),
    actorCount: n.actorIds.length,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  }));

  res.json(paginate ? buildPage(mapped, total, params) : mapped);
}

// PATCH /notifications/:id/read
export async function markRead(req: Request<{ id: string }>, res: Response) {
  const notification = await prisma.notification.findUnique({
    where: { id: req.params.id },
  });
  if (!notification) {
    throw ApiError.notFound('Notification not found');
  }
  if (notification.recipientId !== req.user!.userId) {
    throw ApiError.forbidden('This is not your notification');
  }
  await prisma.notification.update({
    where: { id: req.params.id },
    data: { read: true },
  });
  res.json({ message: 'Marked as read' });
}

// POST /notifications/read-all
export async function markAllRead(req: Request, res: Response) {
  await prisma.notification.updateMany({
    where: { recipientId: req.user!.userId, read: false },
    data: { read: true },
  });
  res.json({ message: 'All marked as read' });
}
