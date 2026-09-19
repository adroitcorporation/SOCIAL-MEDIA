import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { readFile } from 'node:fs/promises';
import type * as Services from '../src/services/community';
import type { db as Database } from '../src/lib/db';
let pg: PGlite;
let server: PGLiteSocketServer;
let db: typeof Database;
let service: typeof Services;
beforeAll(async () => {
  pg = await PGlite.create();
  await pg.exec(await readFile('prisma/migrations/202609200001_initial/migration.sql', 'utf8'));
  await pg.exec(await readFile('prisma/migrations/202609200002_integrity/migration.sql', 'utf8'));
  server = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 54330 });
  await server.start();
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@127.0.0.1:54330/postgres?connection_limit=1';
  ({ db } = await import('../src/lib/db'));
  service = await import('../src/services/community');
  for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'])
    await db.user.create({
      data: { id, name: `Student ${id}`, college: 'Test College', onboarded: true },
    });
});
afterAll(async () => {
  await db?.$disconnect();
  await server?.stop();
  await pg?.close();
});
describe('Connection lifecycle', () => {
  it('persists cancellation, rejects receiver cancellation, removes incoming request, and allows resend', async () => {
    const request = await service.requestConnection('a', 'b');
    await expect(service.transitionConnection('b', request.id, 'cancel')).rejects.toMatchObject({
      status: 403,
    });
    await service.transitionConnection('a', request.id, 'cancel');
    expect((await db.connection.findUniqueOrThrow({ where: { id: request.id } })).status).toBe(
      'CANCELLED',
    );
    const state = await service.snapshot(
      await db.user.findUniqueOrThrow({ where: { id: 'b' } }),
      new URLSearchParams(),
    );
    expect(state.connections).toHaveLength(0);
    const resent = await service.requestConnection('a', 'b');
    expect(resent.id).toBe(request.id);
    expect(resent.status).toBe('PENDING');
    await expect(service.transitionConnection('a', request.id, 'accept')).rejects.toMatchObject({
      status: 403,
    });
    await service.transitionConnection('b', request.id, 'accept');
  });
  it('allows exactly one active relationship for reciprocal/concurrent requests', async () => {
    const results = await Promise.allSettled([
      service.requestConnection('c', 'd'),
      service.requestConnection('d', 'c'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.connection.count({ where: { pairKey: 'c:d' } })).toBe(1);
    await expect(service.requestConnection('a', 'a')).rejects.toMatchObject({ status: 400 });
  });
  it('creates a single direct conversation even when both sides initiate', async () => {
    const [one, two] = await Promise.all([
      service.directConversation('a', 'b'),
      service.directConversation('b', 'a'),
    ]);
    expect(one.id).toBe(two.id);
    expect(await db.conversationMember.count({ where: { conversationId: one.id } })).toBe(2);
  });
});
describe('Accepted-connection groups and authorization', () => {
  let groupId: string;
  it('creates a persisted group from accepted connections in either request direction', async () => {
    const request = await service.requestConnection('e', 'a');
    await service.transitionConnection('a', request.id, 'accept');
    const group = await service.createGroup('a', {
      name: 'Build together',
      memberIds: ['b', 'e', 'b'],
    });
    groupId = group.id;
    const members = await db.conversationMember.findMany({ where: { conversationId: groupId } });
    expect(members).toHaveLength(3);
    expect(members.filter((m) => m.role === 'OWNER')).toEqual([
      expect.objectContaining({ userId: 'a' }),
    ]);
  });
  it('refuses pending and unrelated users', async () => {
    await service.requestConnection('a', 'f');
    await expect(
      service.createGroup('a', { name: 'Invalid', memberIds: ['f'] }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.createGroup('a', { name: 'Invalid', memberIds: ['g'] }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('enforces owner/admin/member permissions and revokes access after removal', async () => {
    await expect(
      service.manageGroup('b', groupId, { action: 'remove', userId: 'e' }),
    ).rejects.toMatchObject({ status: 403 });
    await service.manageGroup('a', groupId, { action: 'promote', userId: 'b' });
    await expect(
      service.manageGroup('b', groupId, { action: 'remove', userId: 'a' }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.manageGroup('b', groupId, { action: 'rename', value: 'Hijacked' }),
    ).rejects.toMatchObject({ status: 403 });
    await service.sendMessage('a', groupId, {
      body: 'Private team message',
      clientId: crypto.randomUUID(),
    });
    await service.manageGroup('b', groupId, { action: 'remove', userId: 'e' });
    await expect(service.readMessages('e', groupId)).rejects.toMatchObject({ status: 403 });
    await expect(
      service.sendMessage('e', groupId, { body: 'Still here?', clientId: crypto.randomUUID() }),
    ).rejects.toMatchObject({ status: 403 });
    await service.manageGroup('a', groupId, { action: 'add', userId: 'e' });
    expect(await service.readMessages('e', groupId)).toHaveLength(1);
  });
  it('deduplicates message retries and tracks unread counts', async () => {
    const clientId = crypto.randomUUID();
    const one = await service.sendMessage('a', groupId, { body: 'Just once', clientId });
    const two = await service.sendMessage('a', groupId, { body: 'Just once', clientId });
    expect(one.id).toBe(two.id);
    let state = await service.snapshot(
      await db.user.findUniqueOrThrow({ where: { id: 'b' } }),
      new URLSearchParams(),
    );
    expect(state.conversations.find((c) => c.id === groupId)?.unread).toBeGreaterThan(0);
    await service.readMessages('b', groupId);
    state = await service.snapshot(
      await db.user.findUniqueOrThrow({ where: { id: 'b' } }),
      new URLSearchParams(),
    );
    expect(state.conversations.find((c) => c.id === groupId)?.unread).toBe(0);
  });
  it('transfers ownership atomically and allows former owner to leave', async () => {
    await expect(service.manageGroup('a', groupId, { action: 'leave' })).rejects.toMatchObject({
      status: 409,
    });
    await service.manageGroup('a', groupId, { action: 'transfer', userId: 'b' });
    await service.manageGroup('a', groupId, { action: 'leave' });
    expect((await db.conversation.findUniqueOrThrow({ where: { id: groupId } })).ownerId).toBe('b');
    expect(
      await db.conversationMember.count({ where: { conversationId: groupId, role: 'OWNER' } }),
    ).toBe(1);
  });
});
describe('One persistent collaboration group per idea', () => {
  let ideaId: string;
  let groupId: string;
  it('deduplicates resonance and concurrently requested official groups', async () => {
    const idea = await service.createIdea('h', {
      title: 'A shared idea',
      description: 'Make something together.',
      category: 'Creative',
      skills: ['Design'],
      tags: [],
    });
    ideaId = idea.id;
    await Promise.all([service.resonate('i', ideaId, true), service.resonate('i', ideaId, true)]);
    expect(await db.ideaResonance.count({ where: { ideaId } })).toBe(1);
    const [first, second] = await Promise.all([
      service.getOrCreateIdeaGroup('h', ideaId, ['i']),
      service.getOrCreateIdeaGroup('h', ideaId, ['i']),
    ]);
    groupId = first.id;
    expect(second.id).toBe(first.id);
    expect(await db.conversation.count({ where: { ideaId } })).toBe(1);
  });
  it('adds a new resonator to the same group and preserves existing messages', async () => {
    await service.sendMessage('h', groupId, {
      body: 'Welcome to our idea',
      clientId: crypto.randomUUID(),
    });
    await service.resonate('j', ideaId, true);
    const group = await service.getOrCreateIdeaGroup('h', ideaId, ['j']);
    expect(group.id).toBe(groupId);
    expect(await db.conversation.count({ where: { ideaId } })).toBe(1);
    expect(await service.readMessages('j', groupId)).toHaveLength(1);
    expect(await db.conversationMember.count({ where: { conversationId: groupId } })).toBe(3);
  });
  it('lets the idea owner kick and re-add eligible members, denying outsiders', async () => {
    await service.manageGroup('h', groupId, { action: 'remove', userId: 'i' });
    await expect(service.readMessages('i', groupId)).rejects.toMatchObject({ status: 403 });
    await service.manageGroup('h', groupId, { action: 'add', userId: 'i' });
    await expect(service.getOrCreateIdeaGroup('i', ideaId, ['j'])).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.getOrCreateIdeaGroup('h', ideaId, ['k'])).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      service.manageGroup('h', groupId, { action: 'transfer', userId: 'i' }),
    ).rejects.toMatchObject({ status: 409 });
    await service.resonate('i', ideaId, false);
    expect(await db.ideaResonance.count({ where: { ideaId, userId: 'i' } })).toBe(0);
    expect(await db.conversation.count({ where: { ideaId } })).toBe(1);
  });
});
describe('Database constraints and discovery safety', () => {
  it('blocks discovery, future requests, and direct message access', async () => {
    await service.blockUser('a', 'b');
    const state = await service.snapshot(
      await db.user.findUniqueOrThrow({ where: { id: 'a' } }),
      new URLSearchParams(),
    );
    expect(state.students.some((u) => ['a', 'b', 'e'].includes(u.id))).toBe(false);
    await expect(service.requestConnection('b', 'a')).rejects.toMatchObject({ status: 403 });
    const direct = await db.conversation.findUniqueOrThrow({ where: { directKey: 'a:b' } });
    await expect(service.readMessages('a', direct.id)).rejects.toMatchObject({ status: 403 });
  });
  it('does not allow profile input to set verification or identity', async () => {
    const profile = await service.saveProfile('l', {
      id: 'a',
      collegeVerified: true,
      emailVerified: true,
      name: 'Student L',
      photo: '',
      college: 'College',
      degree: 'B.Tech',
      graduationYear: 2029,
      city: 'Pune',
      bio: '',
      skills: [],
      interests: [],
      domains: [],
      lookingFor: [],
      linkedin: '',
      github: '',
      instagram: '',
      portfolio: '',
    });
    expect(profile.id).toBe('l');
    expect(profile.collegeVerified).toBe(false);
    expect(profile.emailVerified).toBe(false);
  });
  it('database rejects ownerless groups, two owners, and self-connections', async () => {
    const group = await db.conversation.findFirstOrThrow({ where: { ideaId: { not: null } } });
    // Exercise PostgreSQL constraints directly: a deferred COMMIT error closes the
    // embedded wire adapter's connection, unlike a full PostgreSQL server.
    await db.$disconnect();
    await expect(
      pg.exec(
        `INSERT INTO "Conversation" (id,type,name,"ownerId","updatedAt") VALUES ('invalid-group','GROUP','No owner','a',now())`,
      ),
    ).rejects.toThrow('exactly one owner');
    await expect(
      pg.exec(
        `INSERT INTO "Connection" (id,"requesterId","receiverId","pairKey","updatedAt") VALUES ('invalid-self','a','a','a:a',now())`,
      ),
    ).rejects.toThrow('different_students');
    await expect(
      pg.query(
        `UPDATE "ConversationMember" SET role='OWNER' WHERE "conversationId"=$1 AND "userId"='j'`,
        [group.id],
      ),
    ).rejects.toThrow('one_owner_per_conversation');
  });
});
