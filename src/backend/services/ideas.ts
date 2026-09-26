import { db } from '@/backend/database/client';
import { requireThat } from '@/backend/utils/errors';
import { transaction } from '@/backend/database/transaction';
import { notBlocked } from './access';
import { notify } from './notifications';
import { ideaSchema } from '@/shared/contracts/schemas';
import { visibleTo } from './query-shapes';
import { requireActiveActor } from './permissions';

export async function listResonances(actor: string, ideaId: string) {
  requireThat(
    await db.idea.findFirst({ where: { id: ideaId, authorId: actor } }),
    403,
    'Only the idea author can see who resonated.',
  );
  return db.ideaResonance.findMany({
    where: { ideaId, user: visibleTo(actor) },
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
    const eligible = await tx.ideaResonance.count({
      where: { ideaId, userId: { in: ids }, user: visibleTo(actor) },
    });
    requireThat(
      eligible === ids.length,
      403,
      'Only unblocked students who resonated can be invited.',
    );
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
    if (newIds.length) {
      await tx.conversationMember.createMany({
        data: newIds.map((userId) => ({ conversationId: group.id, userId })),
      });
      await tx.notification.createMany({
        data: newIds.map((userId) => ({
          userId,
          title: 'Let’s build this together',
          body: `You were invited to ${idea.title}.`,
          href: `/messages?conversation=${group.id}`,
        })),
      });
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

export const createIdea = (actor: string, input: unknown) => {
  const data = ideaSchema.parse(input);
  return transaction(async (tx) => {
    await requireActiveActor(actor, tx);
    return tx.idea.create({ data: { ...data, authorId: actor } });
  });
};
