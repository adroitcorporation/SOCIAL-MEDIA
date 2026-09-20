import { requireThat } from '@/backend/utils/errors';
import { transaction } from '@/backend/database/transaction';
import { accepted, notBlocked, pairKey, membership } from './access';
import { notify } from './notifications';
import { z } from 'zod';
import { groupSchema, groupActionSchema, safeUrl } from '@/shared/contracts/schemas';

export async function directConversation(actor: string, target: string) {
  return transaction(async (tx) => {
    await accepted(tx, actor, target);
    return tx.conversation.upsert({
      where: { directKey: pairKey(actor, target) },
      update: {},
      create: {
        type: 'DIRECT',
        directKey: pairKey(actor, target),
        members: { create: [{ userId: actor }, { userId: target }] },
      },
    });
  });
}

export async function createGroup(actor: string, input: unknown) {
  const { name, memberIds } = groupSchema.parse(input);
  const ids = [...new Set(memberIds)].filter((id) => id !== actor);
  requireThat(ids.length > 0, 400, 'Select at least one connection.');
  return transaction(async (tx) => {
    for (const id of ids) await accepted(tx, actor, id);
    const group = await tx.conversation.create({
      data: {
        type: 'GROUP',
        name,
        ownerId: actor,
        members: {
          create: [
            { userId: actor, role: 'OWNER' },
            ...ids.map((userId) => ({ userId, role: 'MEMBER' as const })),
          ],
        },
      },
    });
    for (const id of ids)
      await notify(
        tx,
        id,
        'Welcome to the group',
        `You were added to ${name}.`,
        `/messages?conversation=${group.id}`,
      );
    return group;
  });
}

export async function manageGroup(actor: string, conversationId: string, input: unknown) {
  const data = groupActionSchema.parse(input);
  return transaction(async (tx) => {
    const self = await membership(tx, actor, conversationId);
    const group = self.conversation;
    requireThat(group.type === 'GROUP', 400, 'This is not a group.');
    if (data.action === 'leave') {
      requireThat(
        self.role !== 'OWNER',
        409,
        'Transfer ownership or delete the group before leaving.',
      );
      await tx.conversationMember.delete({
        where: { conversationId_userId: { conversationId, userId: actor } },
      });
      return { ok: true };
    }
    requireThat(self.role !== 'MEMBER', 403, 'Group management requires an owner or admin.');
    if (['rename', 'image', 'delete', 'promote', 'demote', 'transfer'].includes(data.action))
      requireThat(self.role === 'OWNER', 403, 'Only the owner can do this.');
    if (data.action === 'delete') {
      await tx.conversation.delete({ where: { id: conversationId } });
      return { ok: true };
    }
    if (data.action === 'rename' || data.action === 'image') {
      const value =
        data.action === 'rename'
          ? z.string().trim().min(1).max(80).parse(data.value)
          : safeUrl.parse(data.value);
      return tx.conversation.update({
        where: { id: conversationId },
        data: data.action === 'rename' ? { name: value } : { image: value },
      });
    }
    requireThat(data.userId && data.userId !== actor, 400, 'Choose another member.');
    const key = { conversationId, userId: data.userId };
    const target = await tx.conversationMember.findUnique({
      where: { conversationId_userId: key },
    });
    if (data.action === 'add') {
      requireThat(group.members.length < 100, 400, 'Groups support up to 100 members.');
      await notBlocked(tx, actor, data.userId);
      if (group.ideaId) {
        await notBlocked(tx, group.ownerId!, data.userId);
        requireThat(
          await tx.ideaResonance.findUnique({
            where: { ideaId_userId: { ideaId: group.ideaId, userId: data.userId } },
          }),
          403,
          'This student has not resonated with the idea.',
        );
      } else await accepted(tx, actor, data.userId);
      if (!target) {
        await tx.conversationMember.create({ data: key });
        await notify(
          tx,
          data.userId,
          'A new collaboration',
          `You were added to ${group.name}.`,
          `/messages?conversation=${conversationId}`,
        );
      }
      return { ok: true };
    }
    requireThat(target, 404, 'Member not found.');
    requireThat(target.role !== 'OWNER', 403, 'The owner cannot be removed or demoted.');
    requireThat(
      self.role === 'OWNER' || target.role === 'MEMBER',
      403,
      'Admins can only remove normal members.',
    );
    if (data.action === 'remove')
      await tx.conversationMember.delete({ where: { conversationId_userId: key } });
    if (data.action === 'promote' || data.action === 'demote')
      await tx.conversationMember.update({
        where: { conversationId_userId: key },
        data: { role: data.action === 'promote' ? 'ADMIN' : 'MEMBER' },
      });
    if (data.action === 'transfer') {
      requireThat(
        !group.ideaId,
        409,
        'Idea group ownership stays with the idea author. Delete the group if it is no longer needed.',
      );
      await tx.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId: actor } },
        data: { role: 'ADMIN' },
      });
      await tx.conversationMember.update({
        where: { conversationId_userId: key },
        data: { role: 'OWNER' },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { ownerId: data.userId },
      });
    }
    return { ok: true };
  });
}
