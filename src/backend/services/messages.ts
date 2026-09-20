import { requireThat } from '@/backend/utils/errors';
import { transaction } from '@/backend/database/transaction';
import { membership } from './access';
import { z } from 'zod';
import { messageSchema } from '@/shared/contracts/schemas';

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

export async function readMessages(actor: string, conversationId: string, before?: string) {
  return transaction(async (tx) => {
    await membership(tx, actor, conversationId);
    const boundary = before
      ? await tx.message.findFirst({
          where: { id: z.string().max(100).parse(before), conversationId },
        })
      : undefined;
    requireThat(!before || boundary, 400, 'Invalid message cursor.');
    const readAt = new Date();
    const messages = await tx.message.findMany({
      where: {
        conversationId,
        ...(boundary
          ? {
              OR: [
                { createdAt: { lt: boundary.createdAt } },
                { createdAt: boundary.createdAt, id: { lt: boundary.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      include: { sender: true },
    });
    if (!before)
      await tx.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId: actor } },
        data: { lastReadAt: readAt },
      });
    return messages.reverse();
  });
}
