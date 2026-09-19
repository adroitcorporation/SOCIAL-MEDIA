import { Prisma, type User } from '@prisma/client';
import { db } from '@/lib/db';
import { requireThat } from '@/lib/errors';
import { groupSchema, ideaSchema, messageSchema, profileSchema, safeUrl } from '@/lib/validation';
import { z } from 'zod';

type Tx = Prisma.TransactionClient;
export const pairKey = (a: string, b: string) => [a, b].sort().join(':');
export async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(fn, { isolationLevel: 'Serializable', timeout: 15000 });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2034', 'P2002'].includes(error.code) &&
        attempt < 4
      )
        continue;
      throw error;
    }
  }
}
async function notBlocked(tx: Tx, a: string, b: string) {
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
async function accepted(tx: Tx, a: string, b: string) {
  await notBlocked(tx, a, b);
  requireThat(
    await tx.connection.findFirst({ where: { pairKey: pairKey(a, b), status: 'ACCEPTED' } }),
    403,
    'Only accepted connections can be invited.',
  );
}
const notify = (tx: Tx, userId: string, title: string, body: string, href: string) =>
  tx.notification.create({ data: { userId, title, body, href } });

export async function requestConnection(actor: string, target: string) {
  requireThat(actor !== target, 400, 'You cannot connect with yourself.');
  return transaction(async (tx) => {
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
export async function manageGroup(actor: string, conversationId: string, input: unknown) {
  const data = z
    .object({
      action: z.enum([
        'add',
        'remove',
        'promote',
        'demote',
        'rename',
        'image',
        'leave',
        'delete',
        'transfer',
      ]),
      userId: z.string().max(100).optional(),
      value: z.string().max(2048).optional(),
    })
    .parse(input);
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
export const saveProfile = (actor: string, input: unknown) =>
  db.user.update({
    where: { id: actor },
    data: { ...profileSchema.parse(input), onboarded: true },
  });

export async function snapshot(user: User, query: URLSearchParams) {
  const blocks = await db.block.findMany({
    where: { OR: [{ blockerId: user.id }, { blockedId: user.id }] },
  });
  const blockedIds = blocks.map((b) => (b.blockerId === user.id ? b.blockedId : b.blockerId));
  const connections = await db.connection.findMany({
    where: {
      OR: [{ requesterId: user.id }, { receiverId: user.id }],
      status: { in: ['PENDING', 'ACCEPTED'] },
      requesterId: { notIn: blockedIds },
      receiverId: { notIn: blockedIds },
    },
    include: { requester: true, receiver: true },
    orderBy: { updatedAt: 'desc' },
    take: 500,
  });
  const skips = await db.skip.findMany({ where: { userId: user.id } });
  const excluded = [
    user.id,
    ...blockedIds,
    ...skips.map((s) => s.targetId),
    ...connections
      .filter((c) => c.status === 'ACCEPTED')
      .map((c) => (c.requesterId === user.id ? c.receiverId : c.requesterId)),
  ];
  const where: Prisma.UserWhereInput = { onboarded: true, id: { notIn: excluded } };
  const search = query.get('search')?.slice(0, 100);
  if (search)
    where.OR = ['name', 'college', 'bio', 'city'].map((field) => ({
      [field]: { contains: search, mode: 'insensitive' },
    }));
  for (const field of ['college', 'city'] as const)
    if (query.get(field))
      where[field] = { contains: query.get(field)!.slice(0, 100), mode: 'insensitive' };
  for (const field of ['skills', 'interests', 'domains', 'lookingFor'] as const)
    if (query.get(field)) where[field] = { has: query.get(field)!.slice(0, 50) };
  if (query.get('graduationYear'))
    where.graduationYear = z.coerce
      .number()
      .int()
      .min(2020)
      .max(2040)
      .parse(query.get('graduationYear'));
  const page = z.coerce
    .number()
    .int()
    .min(0)
    .max(10000)
    .parse(query.get('page') || 0);
  const [students, totalStudents, ideas, events, notifications, memberships] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 12,
      skip: page * 12,
    }),
    db.user.count({ where }),
    db.idea.findMany({
      where: { authorId: { notIn: blockedIds } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        author: true,
        resonances: { where: { userId: user.id } },
        _count: { select: { resonances: true } },
        conversation: { select: { id: true } },
      },
    }),
    db.event.findMany({
      where: { startsAt: { gte: new Date() } },
      orderBy: { startsAt: 'asc' },
      take: 100,
      include: { savedBy: { where: { userId: user.id } } },
    }),
    db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    db.conversationMember.findMany({
      where: { userId: user.id },
      include: {
        conversation: {
          include: {
            members: { include: { user: true } },
            messages: { take: 1, orderBy: { createdAt: 'desc' }, include: { sender: true } },
          },
        },
      },
      orderBy: { conversation: { updatedAt: 'desc' } },
      take: 100,
    }),
  ]);
  const conversations = await Promise.all(
    memberships
      .filter(
        (m) =>
          m.conversation.type === 'GROUP' ||
          m.conversation.members.every((member) => !blockedIds.includes(member.userId)),
      )
      .map(async (m) => ({
        ...m.conversation,
        myRole: m.role,
        unread: await db.message.count({
          where: {
            conversationId: m.conversationId,
            senderId: { not: user.id },
            createdAt: { gt: m.lastReadAt },
          },
        }),
      })),
  );
  return {
    me: user,
    students,
    totalStudents,
    connections,
    ideas,
    events,
    notifications,
    conversations,
    blockedIds: blocks.filter((b) => b.blockerId === user.id).map((b) => b.blockedId),
  };
}
