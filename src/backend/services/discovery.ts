import { canViewModerationDashboard } from '@/shared/contracts/permissions';
import { Prisma, type User } from '@prisma/client';
import { db } from '@/backend/database/client';
import { z } from 'zod';
import { latestVerification } from './verification';
import { chatIdentity, visibleTo } from './query-shapes';

export async function snapshot(user: User, query: URLSearchParams) {
  // Missing view retains the existing API contract for external callers.
  const view = query.get('view');
  const needs = (...views: string[]) => !view || view === '/' || views.includes(view);
  const feedView = view === '/ideas' || view === '/events';
  const category = query.get('category')?.slice(0, 60);
  const feedSearch = query.get('search')?.slice(0, 100);
  const ideaWhere: Prisma.IdeaWhereInput = {
    author: visibleTo(user.id),
    ...(view === '/ideas'
      ? {
          ...(query.get('only') === 'true' ? { authorId: user.id } : {}),
          ...(category ? { category } : {}),
        }
      : {}),
  };
  const eventWhere: Prisma.EventWhereInput = {
    startsAt: { gte: new Date() },
    ...(view === '/events'
      ? {
          ...(query.get('only') === 'true' ? { savedBy: { some: { userId: user.id } } } : {}),
          ...(category ? { category } : {}),
          ...(feedSearch
            ? {
                OR: [
                  { title: { contains: feedSearch, mode: 'insensitive' } },
                  { location: { contains: feedSearch, mode: 'insensitive' } },
                ],
              }
            : {}),
        }
      : {}),
  };
  const blocks = await db.block.findMany({
    where: { OR: [{ blockerId: user.id }, { blockedId: user.id }] },
  });
  const blockedIds = blocks.map((b) => (b.blockerId === user.id ? b.blockedId : b.blockerId));
  const connectionsPromise = needs('/discover', '/connections', '/messages')
    ? db.connection.findMany({
        where: {
          OR: [{ requesterId: user.id }, { receiverId: user.id }],
          status: { in: ['PENDING', 'ACCEPTED'] },
          requesterId: { notIn: blockedIds },
          receiverId: { notIn: blockedIds },
        },
        include: { requester: true, receiver: true },
        orderBy: { updatedAt: 'desc' },
        take: 500,
      })
    : [];
  const where: Prisma.UserWhereInput = {
    accountStatus: 'ACTIVE',
    onboarded: true,
    id: { not: user.id },
    ...visibleTo(user.id),
    skippedBy: { none: { userId: user.id } },
    sent: { none: { receiverId: user.id, status: 'ACCEPTED' } },
    received: { none: { requesterId: user.id, status: 'ACCEPTED' } },
  };
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
  // Prisma array filters cannot express case-insensitive substring search. Select
  // only this page's IDs in SQL, preserving the existing title/description/skills search.
  const ideaMatches =
    view === '/ideas' && feedSearch
      ? await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT i.id FROM "Idea" i
    WHERE NOT EXISTS (
      SELECT 1 FROM "Block" b WHERE
        (b."blockerId" = ${user.id} AND b."blockedId" = i."authorId") OR
        (b."blockedId" = ${user.id} AND b."blockerId" = i."authorId")
    )
    AND strpos(lower(i.title || ' ' || i.description || ' ' || array_to_string(i.skills, ' ')), lower(${feedSearch})) > 0
    ${category ? Prisma.sql`AND i.category = ${category}` : Prisma.empty}
    ${query.get('only') === 'true' ? Prisma.sql`AND i."authorId" = ${user.id}` : Prisma.empty}
    ORDER BY i."createdAt" DESC, i.id DESC LIMIT 25 OFFSET ${page * 24}
  `)
      : undefined;
  if (ideaMatches) ideaWhere.id = { in: ideaMatches.map((idea) => idea.id) };
  const [
    students,
    totalStudents,
    ideas,
    events,
    notifications,
    memberships,
    verification,
    categories,
    connections,
  ] = await Promise.all([
    needs('/discover')
      ? db.user.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          take: 12,
          skip: page * 12,
        })
      : [],
    needs('/discover') ? db.user.count({ where }) : 0,
    needs('/ideas')
      ? db.idea.findMany({
          where: ideaWhere,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: view === '/ideas' ? 25 : 50,
          skip: view === '/ideas' && !ideaMatches ? page * 24 : 0,
          include: {
            author: true,
            resonances: { where: { userId: user.id } },
            _count: { select: { resonances: true } },
            conversation: { select: { id: true } },
          },
        })
      : [],
    needs('/events')
      ? db.event.findMany({
          where: eventWhere,
          orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
          take: view === '/events' ? 25 : 100,
          skip: view === '/events' ? page * 24 : 0,
          include: { savedBy: { where: { userId: user.id } } },
        })
      : [],
    db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    db.conversationMember.findMany({
      where: {
        userId: user.id,
        conversation: {
          OR: [{ type: 'GROUP' }, { members: { none: { userId: { in: blockedIds } } } }],
        },
      },
      include: {
        conversation: {
          include: {
            members: {
              where: { userId: { notIn: blockedIds } },
              take: !view || view === '/messages' ? undefined : 0,
              select: {
                conversationId: true,
                userId: true,
                role: true,
                joinedAt: true,
                lastReadAt: true,
                user: { select: chatIdentity },
              },
            },
            messages: {
              where: { senderId: { notIn: blockedIds } },
              take: !view || view === '/messages' ? 1 : 0,
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              include: { sender: { select: chatIdentity } },
            },
          },
        },
      },
      orderBy: { conversation: { updatedAt: 'desc' } },
      take: 100,
    }),
    needs('/profile') ? latestVerification(user.id) : null,
    view === '/ideas'
      ? db.idea.groupBy({
          by: ['category'],
          where: { author: visibleTo(user.id) },
          orderBy: { category: 'asc' },
          take: 100,
        })
      : view === '/events'
        ? db.event.groupBy({
            by: ['category'],
            where: { startsAt: eventWhere.startsAt },
            orderBy: { category: 'asc' },
            take: 100,
          })
        : [],
    connectionsPromise,
  ]);
  const visibleMemberships = memberships.filter(
    (member) => !member.clearedAt || member.conversation.updatedAt > member.clearedAt,
  );
  const unread = visibleMemberships.length
    ? await db.message.groupBy({
        by: ['conversationId'],
        where: {
          senderId: { notIn: [user.id, ...blockedIds] },
          OR: visibleMemberships.map((m) => ({
            conversationId: m.conversationId,
            createdAt: { gt: m.lastReadAt },
          })),
        },
        _count: { _all: true },
      })
    : [];
  const counts = new Map(unread.map((row) => [row.conversationId, row._count._all]));
  const conversations = visibleMemberships.map((m) => ({
    ...m.conversation,
    members: m.conversation.members || [],
    messages: (m.conversation.messages || []).filter(
      (message) => !m.clearedAt || message.createdAt > m.clearedAt,
    ),
    myRole: m.role,
    unread: counts.get(m.conversationId) || 0,
  }));
  return {
    me: user,
    verification,
    isModerator: canViewModerationDashboard(user),
    students,
    totalStudents,
    connections,
    ideas: view === '/ideas' ? ideas.slice(0, 24) : ideas,
    events: view === '/events' ? events.slice(0, 24) : events,
    ...(feedView
      ? {
          feed: {
            page,
            hasNext: (view === '/ideas' ? ideas : events).length > 24,
            categories: categories.map((row) => row.category),
          },
        }
      : {}),
    notifications,
    conversations,
    blockedIds: blocks.filter((b) => b.blockerId === user.id).map((b) => b.blockedId),
  };
}
