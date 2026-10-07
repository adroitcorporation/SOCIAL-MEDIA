import { requireThat } from '@/backend/utils/errors';
import { transaction } from '@/backend/database/transaction';
import { membership } from './access';
import { z } from 'zod';
import { messageSchema } from '@/shared/contracts/schemas';
import { chatIdentity, visibleTo } from './query-shapes';

export function canDeleteOwnMessage(
  senderId: string,
  actorId: string,
  createdAt: Date | string,
  now = new Date(),
) {
  if (senderId !== actorId) return false;
  const elapsedMs = now.getTime() - new Date(createdAt).getTime();
  return elapsedMs >= 0 && elapsedMs <= 7 * 60 * 1000;
}

export async function sendMessage(actor: string, conversationId: string, input: unknown) {
  const data = messageSchema.parse(input);
  return transaction(async (tx) => {
    const member = await membership(tx, actor, conversationId);
    const previous = await tx.message.findUnique({
      where: { senderId_clientId: { senderId: actor, clientId: data.clientId } },
    });
    if (previous) {
      requireThat(
        previous.conversationId === conversationId,
        409,
        'Message identifier already used.',
      );
      return previous;
    }
    const latestClear = Math.max(
      0,
      ...member.conversation.members.map((item) => item.clearedAt?.getTime() || 0),
    );
    const createdAt = new Date(Math.max(Date.now(), latestClear ? latestClear + 1 : 0));
    const message = await tx.message.create({
      data: { ...data, senderId: actor, conversationId, createdAt },
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: createdAt },
    });
    // One batched notification write, in the same transaction as the idempotent message.
    const recipients = member.conversation.members
      .filter((item) => item.userId !== actor)
      .map((item) => item.userId);
    if (recipients.length) {
      const [sender, users, blocks] = await Promise.all([
        tx.user.findUniqueOrThrow({ where: { id: actor }, select: { name: true } }),
        tx.user.findMany({
          where: { id: { in: recipients }, accountStatus: 'ACTIVE' },
          select: { id: true },
        }),
        tx.block.findMany({
          where: {
            OR: [
              { blockerId: actor, blockedId: { in: recipients } },
              { blockedId: actor, blockerId: { in: recipients } },
            ],
          },
          select: { blockerId: true, blockedId: true },
        }),
      ]);
      const excluded = new Set(blocks.flatMap((block) => [block.blockerId, block.blockedId]));
      const eligible = users.filter((user) => !excluded.has(user.id));
      if (eligible.length)
        await tx.notification.createMany({
          data: eligible.map((user) => ({
            userId: user.id,
            title:
              member.conversation.type === 'GROUP'
                ? `${sender.name} in ${member.conversation.name || 'your group'}`
                : `${sender.name} sent you a message`,
            body: message.body.slice(0, 180),
            href: `/messages?conversation=${encodeURIComponent(conversationId)}`,
            createdAt,
          })),
        });
    }
    return message;
  });
}

export async function deleteMessage(actor: string, conversationId: string, messageId: string) {
  return transaction(async (tx) => {
    await membership(tx, actor, conversationId);
    const message = await tx.message.findUnique({
      where: { id: messageId, conversationId },
      select: { id: true, senderId: true, createdAt: true },
    });
    requireThat(message, 404, 'Message not found.');
    requireThat(
      canDeleteOwnMessage(message.senderId, actor, message.createdAt),
      403,
      'Messages can only be deleted within 7 minutes of sending.',
    );
    await tx.message.delete({ where: { id: messageId } });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    return { ok: true };
  });
}

export async function readMessages(
  actor: string,
  conversationId: string,
  before?: string,
  after?: string,
) {
  requireThat(!(before && after), 400, 'Use only one message cursor.');
  return transaction(async (tx) => {
    const member = await membership(tx, actor, conversationId);
    const visibleHistory = member.clearedAt ? { createdAt: { gt: member.clearedAt } } : {};
    const cursor = before || after;
    const boundary = cursor
      ? await tx.message.findFirst({
          where: { id: z.string().max(100).parse(cursor), conversationId, ...visibleHistory },
          select: { id: true, createdAt: true },
        })
      : undefined;
    requireThat(!cursor || boundary, 400, 'Invalid message cursor.');
    const readAt = new Date();
    const messages = await tx.message.findMany({
      where: {
        conversationId,
        sender: visibleTo(actor),
        ...visibleHistory,
        ...(boundary
          ? {
              OR: [
                { createdAt: after ? { gt: boundary.createdAt } : { lt: boundary.createdAt } },
                {
                  createdAt: boundary.createdAt,
                  id: after ? { gt: boundary.id } : { lt: boundary.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: after ? 'asc' : 'desc' }, { id: after ? 'asc' : 'desc' }],
      take: 50,
      include: { sender: { select: chatIdentity } },
    });
    if (
      !before &&
      (!after || messages.length || (boundary && member.lastReadAt < boundary.createdAt))
    ) {
      const notificationReadAt =
        after && messages.length === 50
          ? new Date(messages[messages.length - 1].createdAt.getTime() - 1)
          : readAt;
      await tx.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId: actor } },
        // A full batch may end within a timestamp shared by undelivered messages.
        data: {
          lastReadAt: notificationReadAt,
        },
      });
      await tx.notification.updateMany({
        where: {
          userId: actor,
          href: `/messages?conversation=${encodeURIComponent(conversationId)}`,
          readAt: null,
          createdAt: { lte: notificationReadAt },
        },
        data: { readAt: notificationReadAt },
      });
    }
    return after ? messages : messages.reverse();
  });
}
