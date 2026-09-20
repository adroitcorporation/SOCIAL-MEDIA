import type { Prisma, User } from '@prisma/client';
import { db } from '@/backend/database/client';
import { z } from 'zod';

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
