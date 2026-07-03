import type { NotificationType } from '@prisma/client';
import prisma from '../lib/prisma';

interface NotifyParams {
  type: NotificationType;
  recipientId: string;
  actorId: string;
  postId?: string;
}

// Folds a new event into the existing unread bucket for the same
// (recipient, type, post) so likes/comments/follows aggregate into one
// notification ("Alice and 3 others...") instead of spamming one row per
// event. Once the recipient reads it, the next event starts a fresh bucket.
export async function notify({
  type,
  recipientId,
  actorId,
  postId,
}: NotifyParams) {
  if (recipientId === actorId) {
    return; // never notify people about their own activity
  }

  const existing = await prisma.notification.findFirst({
    where: { recipientId, type, postId: postId ?? null, read: false },
  });

  if (existing) {
    if (!existing.actorIds.includes(actorId)) {
      await prisma.notification.update({
        where: { id: existing.id },
        data: { actorIds: { push: actorId } },
      });
    }
    return;
  }

  await prisma.notification.create({
    data: { type, recipientId, postId, actorIds: [actorId] },
  });
}
