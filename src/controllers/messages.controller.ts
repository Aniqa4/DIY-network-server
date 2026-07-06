import type { Request, Response } from 'express';
import prisma from '../lib/prisma';
import ApiError from '../utils/api-error';

// GET /messages — list of people the current user has exchanged messages
// with, most recent first. Fine at small scale; a production inbox would do
// this aggregation in SQL instead of in application code.
export async function inbox(req: Request, res: Response) {
  const userId = req.user!.userId;
  const messages = await prisma.message.findMany({
    where: { OR: [{ senderId: userId }, { receiverId: userId }] },
    orderBy: { createdAt: 'desc' },
    include: {
      sender: { select: { id: true, username: true, avatarUrl: true } },
      receiver: { select: { id: true, username: true, avatarUrl: true } },
    },
  });

  const seen = new Map<string, (typeof messages)[number]>();
  for (const message of messages) {
    const counterpart =
      message.senderId === userId ? message.receiver : message.sender;
    if (!seen.has(counterpart.id)) {
      seen.set(counterpart.id, message);
    }
  }
  res.json([...seen.values()]);
}

// GET /messages/:userId — the thread between the current user and one other user.
export async function conversation(
  req: Request<{ userId: string }>,
  res: Response,
) {
  const userId = req.user!.userId;
  const otherUserId = req.params.userId;
  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json(messages);
}

// POST /messages
export async function send(req: Request, res: Response) {
  const { receiverId, content } = req.body;
  if (req.user!.userId === receiverId) {
    throw ApiError.badRequest('You cannot message yourself');
  }
  const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
  if (!receiver) {
    throw ApiError.notFound('Recipient not found');
  }

  const message = await prisma.message.create({
    data: { senderId: req.user!.userId, receiverId, content },
  });
  res.status(201).json(message);
}
