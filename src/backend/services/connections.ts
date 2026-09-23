import { db } from '@/backend/database/client';
import { requireThat } from '@/backend/utils/errors';
import { transaction } from '@/backend/database/transaction';
import { notBlocked, pairKey } from './access';
import { notify } from './notifications';

export const unblockUser = (actor: string, target: string) =>
  db.block.deleteMany({ where: { blockerId: actor, blockedId: target } });

export async function requestConnection(actor: string, target: string) {
  requireThat(actor !== target, 400, 'You cannot connect with yourself.');
  return transaction(async (tx) => {
    const requester = await tx.user.findUnique({ where: { id: actor } });
    requireThat(requester?.collegeVerified, 403, 'Verify your college email or ID before connecting.');
    await notBlocked(tx, actor, target);
    requireThat(
      await tx.user.findFirst({ where: { id: target, onboarded: true } }),
      404,
      'Student not found.',
    );
    const key = pairKey(actor, target);
    const existing = await tx.connection.findUnique({ where: { pairKey: key } });
    requireThat(
      !existing || !['PENDING', 'ACCEPTED'].includes(existing.status),
      409,
      'A connection or request already exists.',
    );
    const connection = await tx.connection.upsert({
      where: { pairKey: key },
      create: { pairKey: key, requesterId: actor, receiverId: target },
      update: { requesterId: actor, receiverId: target, status: 'PENDING', createdAt: new Date() },
    });
    const user = await tx.user.findUniqueOrThrow({ where: { id: actor } });
    await notify(
      tx,
      target,
      'A new connection request',
      `${user.name} wants to connect with you.`,
      '/connections',
    );
    return connection;
  });
}

export async function transitionConnection(
  actor: string,
  id: string,
  action: 'accept' | 'reject' | 'cancel',
) {
  return transaction(async (tx) => {
    const c = await tx.connection.findUnique({ where: { id } });
    requireThat(c, 404, 'Request not found.');
    requireThat(
      action === 'cancel' ? c.requesterId === actor : c.receiverId === actor,
      403,
      'You do not have permission to change this request.',
    );
    requireThat(c.status === 'PENDING', 409, 'This request is no longer pending.');
    await notBlocked(tx, c.requesterId, c.receiverId);
    const result = await tx.connection.update({
      where: { id },
      data: {
        status: action === 'accept' ? 'ACCEPTED' : action === 'reject' ? 'REJECTED' : 'CANCELLED',
      },
    });
    if (action === 'accept')
      await notify(
        tx,
        c.requesterId,
        'You’re connected!',
        'Your connection request was accepted. Start a conversation.',
        '/connections',
      );
    return result;
  });
}

export async function blockUser(actor: string, target: string) {
  requireThat(actor !== target, 400, 'You cannot block yourself.');
  return transaction(async (tx) => {
    await tx.block.upsert({
      where: { blockerId_blockedId: { blockerId: actor, blockedId: target } },
      create: { blockerId: actor, blockedId: target },
      update: {},
    });
    await tx.connection.updateMany({
      where: { pairKey: pairKey(actor, target) },
      data: { status: 'CANCELLED' },
    });
    return { ok: true };
  });
}
