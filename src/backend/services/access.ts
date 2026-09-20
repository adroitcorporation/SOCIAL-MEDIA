import type { Tx } from '@/backend/types/database';
import { requireThat } from '@/backend/utils/errors';

export const pairKey = (a: string, b: string) => [a, b].sort().join(':');

export async function notBlocked(tx: Tx, a: string, b: string) {
  requireThat(
    !(await tx.block.findFirst({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
    })),
    403,
    'This action is unavailable.',
  );
}

export async function accepted(tx: Tx, a: string, b: string) {
  await notBlocked(tx, a, b);
  requireThat(
    await tx.connection.findFirst({ where: { pairKey: pairKey(a, b), status: 'ACCEPTED' } }),
    403,
    'Only accepted connections can be invited.',
  );
}

export async function membership(tx: Tx, actor: string, conversationId: string) {
  const member = await tx.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: actor } },
    include: { conversation: { include: { members: true } } },
  });
  requireThat(member, 403, 'You no longer have access to this conversation.');
  if (member.conversation.type === 'DIRECT') {
    const other = member.conversation.members.find((m) => m.userId !== actor);
    requireThat(other, 403, 'Conversation unavailable.');
    await accepted(tx, actor, other.userId);
  }
  return member;
}
