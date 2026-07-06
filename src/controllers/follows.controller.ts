import type { Request, Response } from 'express';
import prisma from '../lib/prisma';
import * as notifications from '../services/notifications.service';
import ApiError from '../utils/api-error';
import { parsePageParams, buildPage } from '../lib/pagination';

const SAFE_SELECT = {
  id: true,
  username: true,
  avatarUrl: true,
  bio: true,
} as const;

// Follower/following lists paginate only when ?page is supplied, so the
// unpaginated bootstrap fetch (which seeds the client's follow-state ids)
// keeps receiving the full list.
const wantsPage = (req: Request) => req.query.page !== undefined;

// POST /follows/:userId — toggle follow/unfollow.
export async function toggle(
  req: Request<{ userId: string }>,
  res: Response,
) {
  const followerId = req.user!.userId;
  const followingId = req.params.userId;

  if (followerId === followingId) {
    throw ApiError.badRequest('You cannot follow yourself');
  }
  const target = await prisma.user.findUnique({ where: { id: followingId } });
  if (!target) {
    throw ApiError.notFound('User not found');
  }

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
  });

  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
    res.json({ following: false });
    return;
  }

  await prisma.follow.create({ data: { followerId, followingId } });
  await notifications.notify({
    type: 'FOLLOW',
    recipientId: followingId,
    actorId: followerId,
  });
  res.json({ following: true });
}

// GET /follows/:userId/followers[?page&limit]
export async function getFollowers(
  req: Request<{ userId: string }>,
  res: Response,
) {
  const where = { followingId: req.params.userId };
  if (!wantsPage(req)) {
    const rows = await prisma.follow.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { follower: { select: SAFE_SELECT } },
    });
    res.json(rows.map((row) => row.follower));
    return;
  }
  const params = parsePageParams(req);
  const [rows, total] = await Promise.all([
    prisma.follow.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { follower: { select: SAFE_SELECT } },
      skip: params.skip,
      take: params.limit,
    }),
    prisma.follow.count({ where }),
  ]);
  res.json(buildPage(rows.map((row) => row.follower), total, params));
}

// GET /follows/:userId/following[?page&limit]
export async function getFollowing(
  req: Request<{ userId: string }>,
  res: Response,
) {
  const where = { followerId: req.params.userId };
  if (!wantsPage(req)) {
    const rows = await prisma.follow.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { following: { select: SAFE_SELECT } },
    });
    res.json(rows.map((row) => row.following));
    return;
  }
  const params = parsePageParams(req);
  const [rows, total] = await Promise.all([
    prisma.follow.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { following: { select: SAFE_SELECT } },
      skip: params.skip,
      take: params.limit,
    }),
    prisma.follow.count({ where }),
  ]);
  res.json(buildPage(rows.map((row) => row.following), total, params));
}
