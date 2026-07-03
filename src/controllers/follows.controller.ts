import type { Request, Response } from 'express';
import prisma from '../lib/prisma';
import * as notifications from '../services/notifications.service';
import ApiError from '../utils/api-error';

const SAFE_SELECT = {
  id: true,
  username: true,
  avatarUrl: true,
  bio: true,
} as const;

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

// GET /follows/:userId/followers
export async function getFollowers(
  req: Request<{ userId: string }>,
  res: Response,
) {
  const rows = await prisma.follow.findMany({
    where: { followingId: req.params.userId },
    orderBy: { createdAt: 'desc' },
    include: { follower: { select: SAFE_SELECT } },
  });
  res.json(rows.map((row) => row.follower));
}

// GET /follows/:userId/following
export async function getFollowing(
  req: Request<{ userId: string }>,
  res: Response,
) {
  const rows = await prisma.follow.findMany({
    where: { followerId: req.params.userId },
    orderBy: { createdAt: 'desc' },
    include: { following: { select: SAFE_SELECT } },
  });
  res.json(rows.map((row) => row.following));
}
