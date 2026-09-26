import { requireThat } from '@/backend/utils/errors';
import { transaction } from '@/backend/database/transaction';
import { membership } from './access';
import { z } from 'zod';
import { messageSchema } from '@/shared/contracts/schemas';
import { chatIdentity, visibleTo } from './query-shapes';

export async function sendMessage(actor: string, conversationId: string, input: unknown) {
  const data = messageSchema.parse(input);
  return transaction(async (tx) => {
    await membership(tx, actor, conversationId);
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
    const message = await tx.message.create({ data: { ...data, senderId: actor, conversationId } });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    return message;
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
    const cursor = before || after;
    const boundary = cursor
      ? await tx.message.findFirst({
          where: { id: z.string().max(100).parse(cursor), conversationId },
          select: { id: true, createdAt: true },
        })
      : undefined;
    requireThat(!cursor || boundary, 400, 'Invalid message cursor.');
    const readAt = new Date();
    const messages = await tx.message.findMany({
      where: {
        conversationId,
        sender: visibleTo(actor),
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
    )
      await tx.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId: actor } },
        // A full batch may end within a timestamp shared by undelivered messages.
        data: {
          lastReadAt:
            after && messages.length === 50
              ? new Date(messages[messages.length - 1].createdAt.getTime() - 1)
              : readAt,
        },
      });
    return after ? messages : messages.reverse();
  });
}
