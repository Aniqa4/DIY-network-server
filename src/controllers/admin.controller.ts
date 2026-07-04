import type { Request, Response } from 'express';
import type { Role } from '@prisma/client';
import prisma from '../lib/prisma';
import ApiError from '../utils/api-error';

const STAFF_SELECT = {
  id: true,
  username: true,
  email: true,
  avatarUrl: true,
  role: true,
  createdAt: true,
} as const;

// -- staff list (admin + moderator) ----------------------------------------

// GET /admin/staff — everyone on the team. Visible to staff.
export async function listStaff(req: Request, res: Response) {
  const staff = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'MODERATOR'] } },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: STAFF_SELECT,
  });
  res.json(staff);
}

// -- invites ----------------------------------------------------------------

// GET /admin/invites — pending invitations. Admin only.
export async function listInvites(req: Request, res: Response) {
  const invites = await prisma.staffInvite.findMany({
    where: { status: 'PENDING' },
    orderBy: { updatedAt: 'desc' },
    include: {
      user: { select: { id: true, username: true, avatarUrl: true } },
    },
  });
  res.json(invites);
}

// POST /admin/invites — invite a user (by username) to a staff role. Admin only.
export async function createInvite(req: Request, res: Response) {
  const { username, role } = req.body as { username: string; role: Role };

  const target = await prisma.user.findUnique({ where: { username } });
  if (!target) throw ApiError.notFound('No user with that username');
  if (target.id === req.user!.userId) {
    throw ApiError.badRequest('You are already an admin');
  }
  if (target.role === role) {
    throw ApiError.conflict(`That user is already a ${role.toLowerCase()}`);
  }

  // One invite row per user, reused: re-inviting flips it back to PENDING.
  const invite = await prisma.staffInvite.upsert({
    where: { userId: target.id },
    create: { userId: target.id, role, invitedById: req.user!.userId, status: 'PENDING' },
    update: { role, invitedById: req.user!.userId, status: 'PENDING' },
    include: {
      user: { select: { id: true, username: true, avatarUrl: true } },
    },
  });
  res.status(201).json(invite);
}

// DELETE /admin/invites/:id — admin cancels a pending invite.
export async function cancelInvite(req: Request<{ id: string }>, res: Response) {
  const invite = await prisma.staffInvite.findUnique({ where: { id: req.params.id } });
  if (!invite) throw ApiError.notFound('Invite not found');
  await prisma.staffInvite.update({
    where: { id: req.params.id },
    data: { status: 'CANCELLED' },
  });
  res.json({ message: 'Invite cancelled' });
}

// GET /me/invite — the current user's pending staff invite, if any.
export async function myInvite(req: Request, res: Response) {
  const invite = await prisma.staffInvite.findUnique({
    where: { userId: req.user!.userId },
    include: {
      invitedBy: { select: { id: true, username: true } },
    },
  });
  res.json(invite && invite.status === 'PENDING' ? invite : null);
}

// POST /me/invite/accept — accept the pending invite; adopt the offered role.
export async function acceptInvite(req: Request, res: Response) {
  const invite = await prisma.staffInvite.findUnique({
    where: { userId: req.user!.userId },
  });
  if (!invite || invite.status !== 'PENDING') {
    throw ApiError.notFound('No pending invite');
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: req.user!.userId }, data: { role: invite.role } }),
    prisma.staffInvite.update({ where: { id: invite.id }, data: { status: 'ACCEPTED' } }),
  ]);
  res.json({ role: invite.role });
}

// POST /me/invite/reject — decline the pending invite.
export async function rejectInvite(req: Request, res: Response) {
  const invite = await prisma.staffInvite.findUnique({
    where: { userId: req.user!.userId },
  });
  if (!invite || invite.status !== 'PENDING') {
    throw ApiError.notFound('No pending invite');
  }
  await prisma.staffInvite.update({
    where: { id: invite.id },
    data: { status: 'REJECTED' },
  });
  res.json({ message: 'Invite declined' });
}

// -- member management ------------------------------------------------------

// PATCH /admin/staff/:userId/role — change a member's role. Admin only.
export async function changeRole(req: Request<{ userId: string }>, res: Response) {
  const { role } = req.body as { role: Role };
  if (req.params.userId === req.user!.userId) {
    throw ApiError.badRequest('You cannot change your own role');
  }
  const target = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!target) throw ApiError.notFound('User not found');

  const user = await prisma.user.update({
    where: { id: req.params.userId },
    data: { role },
    select: STAFF_SELECT,
  });
  res.json(user);
}

// DELETE /admin/staff/:userId — remove someone from the team (back to USER).
export async function removeMember(req: Request<{ userId: string }>, res: Response) {
  if (req.params.userId === req.user!.userId) {
    throw ApiError.badRequest('You cannot remove yourself');
  }
  const target = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!target) throw ApiError.notFound('User not found');

  await prisma.user.update({
    where: { id: req.params.userId },
    data: { role: 'USER' },
  });
  res.json({ message: 'Member removed' });
}

// -- banning ----------------------------------------------------------------

// POST /admin/posts/:id/ban  and  /unban — staff hide/restore a post.
export function setPostBanned(banned: boolean) {
  return async (req: Request<{ id: string }>, res: Response) => {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) throw ApiError.notFound('Post not found');
    await prisma.post.update({ where: { id: req.params.id }, data: { banned } });
    res.json({ banned });
  };
}

// POST /admin/users/:id/ban  and  /unban — staff hide/restore a profile.
// Admins can't be banned; only admins may ban a moderator.
export function setUserBanned(banned: boolean) {
  return async (req: Request<{ id: string }>, res: Response) => {
    if (req.params.id === req.user!.userId) {
      throw ApiError.badRequest('You cannot ban yourself');
    }
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw ApiError.notFound('User not found');
    if (target.role === 'ADMIN') {
      throw ApiError.forbidden('Admins cannot be banned');
    }
    if (target.role === 'MODERATOR' && req.user!.role !== 'ADMIN') {
      throw ApiError.forbidden('Only an admin can ban a moderator');
    }
    await prisma.user.update({ where: { id: req.params.id }, data: { banned } });
    res.json({ banned });
  };
}
