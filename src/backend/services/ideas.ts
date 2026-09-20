import { db } from '@/backend/database/client';
import { requireThat } from '@/backend/utils/errors';
import { transaction } from '@/backend/database/transaction';
import { notBlocked } from './access';
import { notify } from './notifications';
import { ideaSchema } from '@/shared/contracts/schemas';

export async function listResonances(actor: string, ideaId: string) {
  requireThat(
    await db.idea.findFirst({ where: { id: ideaId, authorId: actor } }),
    403,
    'Only the idea author can see who resonated.',
  );
  return db.ideaResonance.findMany({
    where: { ideaId },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
}

export async function getOrCreateIdeaGroup(actor: string, ideaId: string, memberIds: string[]) {
  requireThat(memberIds.length <= 49, 400, 'Select up to 49 students.');
  return transaction(async (tx) => {
    const idea = await tx.idea.findUnique({ where: { id: ideaId } });
    requireThat(idea, 404, 'Idea not found.');
    requireThat(
      idea.authorId === actor,
      403,
      'Only the idea owner can manage its collaboration group.',
    );
    const ids = [...new Set(memberIds)].filter((id) => id !== actor);
    for (const userId of ids) {
      await notBlocked(tx, actor, userId);
      requireThat(
        await tx.ideaResonance.findUnique({ where: { ideaId_userId: { ideaId, userId } } }),
        403,
        'Only students who resonated can be invited.',
      );
    }
    const group = await tx.conversation.upsert({
      where: { ideaId },
      update: {},
      create: {
        type: 'GROUP',
        ideaId,
        name: idea.title,
        ownerId: actor,
        members: { create: { userId: actor, role: 'OWNER' } },
      },
    });
    const currentMembers = await tx.conversationMember.findMany({
      where: { conversationId: group.id },
      select: { userId: true },
    });
    const newIds = ids.filter((id) => !currentMembers.some((member) => member.userId === id));
    requireThat(
      currentMembers.length + newIds.length <= 100,
      400,
      'Groups support up to 100 members.',
    );
    for (const userId of newIds) {
      const exists = await tx.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId: group.id, userId } },
      });
      if (!exists) {
        await tx.conversationMember.create({ data: { conversationId: group.id, userId } });
        await notify(
          tx,
          userId,
          'Let’s build this together',
          `You were invited to ${idea.title}.`,
          `/messages?conversation=${group.id}`,
        );
      }
    }
    return group;
  });
}

export async function resonate(actor: string, ideaId: string, enabled: boolean) {
  return transaction(async (tx) => {
    const idea = await tx.idea.findUnique({ where: { id: ideaId } });
    requireThat(idea, 404, 'Idea not found.');
    requireThat(idea.authorId !== actor, 400, 'You already own this idea.');
    await notBlocked(tx, actor, idea.authorId);
    const key = { ideaId, userId: actor };
    if (!enabled) {
      await tx.ideaResonance.deleteMany({ where: key });
      return { ok: true };
    }
    if (!(await tx.ideaResonance.findUnique({ where: { ideaId_userId: key } }))) {
      await tx.ideaResonance.create({ data: key });
      const user = await tx.user.findUniqueOrThrow({ where: { id: actor } });
      await notify(
        tx,
        idea.authorId,
        'Your idea resonates',
        `${user.name} is interested in “${idea.title}”.`,
        `/ideas?idea=${ideaId}`,
      );
    }
    return { ok: true };
  });
}

export const createIdea = (actor: string, input: unknown) =>
  db.idea.create({ data: { ...ideaSchema.parse(input), authorId: actor } });
