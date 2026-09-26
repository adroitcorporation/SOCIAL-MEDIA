import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { readdir, readFile } from 'node:fs/promises';
import type { db as Database } from '@/backend/database/client';
import type * as Services from '@/backend/services/community';

let pg: PGlite;
let server: PGLiteSocketServer;
let db: typeof Database;
let service: typeof Services;
let conversationId: string;
beforeAll(async () => {
  pg = await PGlite.create();
  const directory = 'src/backend/database/prisma/migrations';
  for (const entry of (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name)))
    await pg.exec(await readFile(`${directory}/${entry.name}/migration.sql`, 'utf8'));
  server = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 54338 });
  await server.start();
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@127.0.0.1:54338/postgres?connection_limit=1';
  ({ db } = await import('@/backend/database/client'));
  service = await import('@/backend/services/community');
  await db.user.createMany({
    data: ['actor', 'peer', 'outsider'].map((id) => ({
      id,
      name: id,
      onboarded: true,
      collegeVerified: true,
    })),
  });
  const connection = await service.requestConnection('actor', 'peer');
  await service.transitionConnection('peer', connection.id, 'accept');
  conversationId = (await service.directConversation('actor', 'peer')).id;
  await db.message.createMany({
    data: Array.from({ length: 120 }, (_, index) => ({
      id: `message-${String(index).padStart(3, '0')}`,
      conversationId,
      senderId: 'peer',
      clientId: `client-${index}`,
      body: `Message ${index}`,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    })),
  });
  await db.idea.createMany({
    data: Array.from({ length: 55 }, (_, index) => ({
      id: `idea-${index}`,
      authorId: 'actor',
      title: `Idea ${index}`,
      description: 'Paginated idea',
      category: index === 0 ? 'Rare' : 'Technology',
      skills: ['React'],
      tags: [],
    })),
  });
  await db.event.createMany({
    data: Array.from({ length: 55 }, (_, index) => ({
      id: `event-${index}`,
      title: `Event ${index}`,
      description: 'Paginated event',
      category: 'Hackathon',
      organizer: 'Campus',
      location: 'Jaipur',
      startsAt: new Date('2040-01-01T00:00:00Z'),
      url: '',
    })),
  });
});
afterAll(async () => {
  await db?.$disconnect();
  await server?.stop();
  await pg?.close();
});

it('paginates both directions through equal message timestamps without gaps or duplicates', async () => {
  const recent = await service.readMessages('actor', conversationId);
  expect(recent).toHaveLength(50);
  expect(recent[0].id).toBe('message-070');
  expect(Object.keys(recent[0].sender).sort()).toEqual(['id', 'name', 'photo']);
  const older = await service.readMessages('actor', conversationId, recent[0].id);
  expect(older.map((message) => message.id)).toEqual(
    Array.from({ length: 50 }, (_, index) => `message-${String(index + 20).padStart(3, '0')}`),
  );
  const newer = await service.readMessages('actor', conversationId, undefined, 'message-019');
  expect(newer.map((message) => message.id)).toEqual(older.map((message) => message.id));
  expect(await service.readMessages('actor', conversationId, undefined, 'message-119')).toEqual([]);
  await expect(
    service.readMessages('outsider', conversationId, undefined, 'message-119'),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    service.readMessages('actor', conversationId, 'message-001', 'message-002'),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    service.readMessages('actor', conversationId, undefined, 'missing'),
  ).rejects.toMatchObject({ status: 400 });
});

it('batches unread counts and omits unrelated feeds from chat snapshots', async () => {
  await db.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId: 'actor' } },
    data: { lastReadAt: new Date('2025-01-01') },
  });
  const count = vi.spyOn(db.message, 'count');
  const grouped = vi.spyOn(db.message, 'groupBy');
  const state = await service.snapshot(
    await db.user.findUniqueOrThrow({ where: { id: 'actor' } }),
    new URLSearchParams({ view: '/messages' }),
  );
  expect(state.conversations[0].unread).toBe(120);
  expect(state.students).toEqual([]);
  expect(state.ideas).toEqual([]);
  expect(state.events).toEqual([]);
  expect(count).not.toHaveBeenCalled();
  expect(grouped).toHaveBeenCalledOnce();
  count.mockRestore();
  grouped.mockRestore();
});

it('pages and filters ideas and upcoming events across the entire dataset', async () => {
  const actor = await db.user.findUniqueOrThrow({ where: { id: 'actor' } });
  for (const view of ['/ideas', '/events']) {
    const key = view === '/ideas' ? 'ideas' : 'events';
    const first = await service.snapshot(actor, new URLSearchParams({ view }));
    const second = await service.snapshot(actor, new URLSearchParams({ view, page: '1' }));
    expect(first[key]).toHaveLength(24);
    expect(second[key]).toHaveLength(24);
    expect(new Set([...first[key], ...second[key]].map((row) => row.id)).size).toBe(48);
    expect(second.feed?.hasNext).toBe(true);
    const third = await service.snapshot(actor, new URLSearchParams({ view, page: '2' }));
    expect(third[key]).toHaveLength(7);
    expect(third.feed?.hasNext).toBe(false);
  }
  const filtered = await service.snapshot(
    actor,
    new URLSearchParams({ view: '/ideas', category: 'Rare' }),
  );
  expect(filtered.ideas.map((idea) => idea.id)).toEqual(['idea-0']);
  const skillSearch = await service.snapshot(
    actor,
    new URLSearchParams({ view: '/ideas', search: 'rEa', page: '2' }),
  );
  expect(skillSearch.ideas).toHaveLength(7);
  const literalSearch = await service.snapshot(
    actor,
    new URLSearchParams({ view: '/ideas', search: "%' OR 1=1 --" }),
  );
  expect(literalSearch.ideas).toEqual([]);
  const saved = await service.snapshot(
    actor,
    new URLSearchParams({ view: '/events', only: 'true' }),
  );
  expect(saved.events).toEqual([]);
});

it('excludes skipped and accepted users directly in discovery', async () => {
  await db.skip.create({ data: { userId: 'actor', targetId: 'outsider' } });
  const state = await service.snapshot(
    await db.user.findUniqueOrThrow({ where: { id: 'actor' } }),
    new URLSearchParams({ view: '/discover' }),
  );
  expect(state.students).toEqual([]);
  expect(state.totalStudents).toBe(0);
});

it('applies the performance migration on PostgreSQL', async () => {
  const result = await pg.query<{ indexname: string }>(
    'SELECT indexname FROM pg_indexes WHERE schemaname = $1',
    ['public'],
  );
  const names = result.rows.map((row) => row.indexname);
  expect(names).toContain('Message_conversationId_createdAt_id_idx');
  expect(names).toContain('Block_blockedId_idx');
  expect(names).toContain('RateLimit_expiresAt_idx');
});
