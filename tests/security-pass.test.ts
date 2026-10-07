import { connectionReadyProfile } from './fixtures/connection-ready';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { readFile, readdir } from 'node:fs/promises';
import sharp from 'sharp';
import { authenticate } from '@/backend/auth/session';
import { decodeVerificationImage } from '@/backend/services/verification-image';
import type { db as Database } from '@/backend/database/client';
import type * as Services from '@/backend/services/community';
import type { handleApiRequest as Handler } from '@/backend/http/api-handler';

// Only the identity provider is mocked. Services, Prisma and migrations use an
// isolated, in-memory PostgreSQL-compatible database containing synthetic users.
vi.mock('@/backend/auth/session', () => ({ authenticate: vi.fn(), isLocalDemo: () => false }));
let pg: PGlite;
let server: PGLiteSocketServer;
let db: typeof Database;
let service: typeof Services;
let handle: typeof Handler;
let sequence = 0;
const ideaInput = {
  title: 'Security fixture',
  description: 'Synthetic content',
  category: 'Test',
  skills: [],
  tags: [],
};
async function user() {
  return db.user.create({
    data: {
      id: `security-pass-${++sequence}`,
      ...connectionReadyProfile,
      name: 'Synthetic student',
      onboarded: true,
      collegeVerified: true,
    },
  });
}
async function api(actor: string, route: string, body?: unknown, method = 'POST') {
  vi.mocked(authenticate).mockResolvedValue(
    await db.user.findUniqueOrThrow({ where: { id: actor } }),
  );
  return handle(
    new Request(`http://localhost:3000/api/${route}`, {
      method: body === undefined ? 'GET' : method,
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    route.split('?')[0].split('/'),
  );
}
async function connect(a: string, b: string) {
  const request = await service.requestConnection(a, b);
  await service.transitionConnection(b, request.id, 'accept');
}
beforeAll(async () => {
  pg = await PGlite.create();
  const root = 'src/backend/database/prisma/migrations';
  for (const directory of (await readdir(root, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort())
    await pg.exec(await readFile(`${root}/${directory}/migration.sql`, 'utf8'));
  server = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 54334 });
  await server.start();
  vi.stubEnv(
    'DATABASE_URL',
    'postgresql://postgres:postgres@127.0.0.1:54334/postgres?connection_limit=1',
  );
  vi.stubEnv('APP_URL', 'http://localhost:3000');
  ({ db } = await import('@/backend/database/client'));
  service = await import('@/backend/services/community');
  ({ handleApiRequest: handle } = await import('@/backend/http/api-handler'));
});
afterEach(() => vi.restoreAllMocks());

describe('profile photo gateway', () => {
  async function photo(actor: string, bytes: Uint8Array, mime = 'image/png') {
    vi.mocked(authenticate).mockResolvedValue(
      await db.user.findUniqueOrThrow({ where: { id: actor } }),
    );
    return handle(
      new Request('http://localhost:3000/api/profile/photo', {
        method: 'POST',
        headers: {
          'content-type': 'application/octet-stream',
          'x-profile-photo-type': mime,
          origin: 'http://localhost:3000',
        },
        body: new Uint8Array(bytes),
      }),
      ['profile', 'photo'],
    );
  }
  it('denies inactive accounts before accepting bytes', async () => {
    const actor = await user();
    await db.user.update({ where: { id: actor.id }, data: { accountStatus: 'BANNED' } });
    expect((await photo(actor.id, Buffer.alloc(4_000_001))).status).toBe(403);
  });
  it('bounds the binary body on the server and rejects forged images', async () => {
    const actor = await user();
    expect((await photo(actor.id, Buffer.alloc(4_000_001))).status).toBe(413);
    expect((await photo(actor.id, Buffer.from('<script>not an image</script>'))).status).toBe(400);
  });
  it('limits photo requests independently of other mutations', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    const actor = await user();
    for (let i = 0; i < 6; i++)
      expect((await photo(actor.id, Buffer.from('bad image'))).status).toBe(400);
    expect((await photo(actor.id, Buffer.from('bad image'))).status).toBe(429);
    expect((await api(actor.id, `skips/${(await user()).id}`, {})).status).toBe(200);
  });
});
afterAll(async () => {
  await db?.$disconnect();
  await server?.stop();
  await pg?.close();
  vi.unstubAllEnvs();
});

describe('connection profile completion enforcement', () => {
  it('reports missing profile fields first while preserving the independent verification gate', async () => {
    const sender = await user(),
      receiver = await user();
    await db.user.update({ where: { id: sender.id }, data: { bio: '', collegeVerified: false } });
    const incomplete = await api(sender.id, 'connections', { userId: receiver.id });
    expect(await incomplete.json()).toMatchObject({
      code: 'PROFILE_INCOMPLETE',
      missingFields: ['bio'],
    });
    await db.user.update({ where: { id: sender.id }, data: { bio: connectionReadyProfile.bio } });
    const unverified = await api(sender.id, 'connections', { userId: receiver.id });
    expect(unverified.status).toBe(403);
    expect(await unverified.json()).toEqual({
      error: 'Verify your college email or ID before connecting.',
    });
  });
  it.each([
    ['bio', ''],
    ['bio', 'short'],
    ['name', '   '],
    ['college', ''],
    ['graduationYear', 0],
    ['skills', []],
    ['skills', ['   ']],
    ['lookingFor', []],
    ['lookingFor', ['   ']],
    ['interests', []],
  ])(
    'rejects a direct API request with invalid %s from trusted database data',
    async (field, value) => {
      const sender = await user(),
        receiver = await user();
      await db.user.update({ where: { id: sender.id }, data: { [field as string]: value } });
      const response = await api(sender.id, 'connections', {
        userId: receiver.id,
        isComplete: true,
        onboarded: true,
        profile: connectionReadyProfile,
      });
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
        code: 'PROFILE_INCOMPLETE',
        message: 'Complete your profile before sending connection requests.',
        missingFields: [field === 'interests' ? 'interestsOrDomains' : field],
      });
      expect(await db.connection.count({ where: { requesterId: sender.id } })).toBe(0);
      expect(await db.notification.count({ where: { userId: receiver.id } })).toBe(0);
      expect((await api(sender.id, 'state?view=/')).status).toBe(200);
    },
  );
  it('allows a complete verified sender and accepts domains instead of interests', async () => {
    const sender = await user(),
      receiver = await user();
    await db.user.update({
      where: { id: sender.id },
      data: { interests: [], domains: ['Education'], onboarded: false },
    });
    const response = await api(sender.id, 'connections', { userId: receiver.id });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'PENDING', requesterId: sender.id });
  });
  it('preserves incoming acceptance/rejection and existing direct/group messages after a profile becomes incomplete', async () => {
    const sender = await user(),
      peer = await user(),
      incoming = await user(),
      rejected = await user();
    await connect(sender.id, peer.id);
    const direct = await service.directConversation(sender.id, peer.id);
    const group = await service.createGroup(sender.id, {
      name: 'Existing group',
      memberIds: [peer.id],
    });
    const pending = await service.requestConnection(incoming.id, sender.id);
    const decline = await service.requestConnection(rejected.id, sender.id);
    await db.user.update({
      where: { id: sender.id },
      data: { bio: '', skills: [], lookingFor: [] },
    });
    expect((await service.transitionConnection(sender.id, pending.id, 'accept')).status).toBe(
      'ACCEPTED',
    );
    expect((await service.transitionConnection(sender.id, decline.id, 'reject')).status).toBe(
      'REJECTED',
    );
    for (const conversation of [direct, group])
      expect(
        (
          await service.sendMessage(sender.id, conversation.id, {
            body: 'Existing conversation still works.',
            clientId: crypto.randomUUID(),
          })
        ).body,
      ).toBe('Existing conversation still works.');
    const another = await user();
    await service.requestConnection(another.id, sender.id);
    expect((await service.requestConnection(sender.id, another.id)).status).toBe('ACCEPTED');
  });
});

describe('block privacy regressions', () => {
  it('hides revoked direct conversations from every state view after blocking and unblocking', async () => {
    const a = await user();
    const b = await user();
    await connect(a.id, b.id);
    const direct = await service.directConversation(a.id, b.id);
    await service.sendMessage(b.id, direct.id, {
      body: 'Private revoked preview',
      clientId: crypto.randomUUID(),
    });
    await service.blockUser(a.id, b.id);
    await service.unblockUser(a.id, b.id);
    expect((await api(a.id, `conversations/${direct.id}/messages`)).status).toBe(403);
    for (const query of ['', '?view=/messages', '?view=/profile', '?view=/']) {
      const response = await api(a.id, `state${query}`);
      expect(response.status).toBe(200);
      const state = await response.json();
      expect(state.conversations.some((item: { id: string }) => item.id === direct.id)).toBe(false);
      // Previously delivered notifications belong to the recipient; revoke chat previews/history.
      expect(JSON.stringify(state.conversations)).not.toContain('Private revoked preview');
    }
    const pending = await service.requestConnection(a.id, b.id);
    await service.transitionConnection(b.id, pending.id, 'accept');
    const restored = await (await api(a.id, 'state?view=/messages')).json();
    expect(restored.conversations.some((item: { id: string }) => item.id === direct.id)).toBe(true);
  });

  it.each(['owner', 'resonator'])(
    'hides resonator profiles after a block by the %s',
    async (direction) => {
      const owner = await user();
      const victim = await user();
      const idea = await service.createIdea(owner.id, ideaInput);
      await service.resonate(victim.id, idea.id, true);
      await service.blockUser(
        direction === 'owner' ? owner.id : victim.id,
        direction === 'owner' ? victim.id : owner.id,
      );
      expect((await api(owner.id, `students/${victim.id}`)).status).toBe(403);
      await db.user.update({ where: { id: victim.id }, data: { city: 'Updated after blocking' } });
      const response = await api(owner.id, `ideas/${idea.id}/resonances`);
      expect(response.status).toBe(200);
      expect((await response.json()).some((r: { userId: string }) => r.userId === victim.id)).toBe(
        false,
      );
    },
  );
  async function groupFixture() {
    const owner = await user();
    const victim = await user();
    await connect(owner.id, victim.id);
    const group = await service.createGroup(owner.id, {
      name: 'Synthetic group',
      memberIds: [victim.id],
    });
    await service.blockUser(victim.id, owner.id);
    await db.user.update({ where: { id: victim.id }, data: { city: 'Updated private city' } });
    await service.sendMessage(victim.id, group.id, {
      body: 'Synthetic post-block message',
      clientId: crypto.randomUUID(),
    });
    return { owner, victim, group };
  }
  it('omits blocked profiles and messages from nested group state', async () => {
    const { owner, victim, group } = await groupFixture();
    const state = await (await api(owner.id, 'state?search=Synthetic')).json();
    expect(state.students.some((u: { id: string }) => u.id === victim.id)).toBe(false);
    expect(
      state.connections.some((c: { requesterId: string; receiverId: string }) =>
        [c.requesterId, c.receiverId].includes(victim.id),
      ),
    ).toBe(false);
    const visible = state.conversations.find((c: { id: string }) => c.id === group.id);
    expect(JSON.stringify(visible)).not.toContain('Updated private city');
    expect(JSON.stringify(visible)).not.toContain('Synthetic post-block message');
  });
  it('omits blocked senders and their messages from group history', async () => {
    const { owner, victim, group } = await groupFixture();
    const response = await api(owner.id, `conversations/${group.id}/messages`);
    expect(response.status).toBe(200);
    expect(
      (await response.json()).some((m: { senderId: string }) => m.senderId === victim.id),
    ).toBe(false);
  });
});

describe('deterministic in-flight revocation', () => {
  // Pauses after API authentication/status checks but before the service call.
  // This is an ordering test, not a claim about parallel PostgreSQL contention.
  async function pausedMutation(
    actor: string,
    route: string,
    body: unknown,
    revoke: () => Promise<unknown>,
  ) {
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const original = db.rateLimit.upsert.bind(db.rateLimit);
    vi.spyOn(db.rateLimit, 'upsert').mockImplementationOnce((async (
      args: Parameters<typeof original>[0],
    ) => {
      entered.resolve();
      await release.promise;
      return original(args);
    }) as unknown as typeof db.rateLimit.upsert);
    const pending = api(actor, route, body);
    await entered.promise;
    try {
      await revoke();
    } finally {
      release.resolve();
    }
    return pending;
  }

  it('rejects a group message when suspension commits after API authentication', async () => {
    const owner = await user();
    const member = await user();
    await connect(owner.id, member.id);
    const group = await service.createGroup(owner.id, {
      name: 'Revocation fixture',
      memberIds: [member.id],
    });
    const response = await pausedMutation(
      member.id,
      `conversations/${group.id}/messages`,
      { body: 'Must not persist after suspension', clientId: crypto.randomUUID() },
      () => db.user.update({ where: { id: member.id }, data: { accountStatus: 'SUSPENDED' } }),
    );
    expect(response.status).toBe(403);
    expect(await db.message.count({ where: { conversationId: group.id } })).toBe(0);
  });
  it('rejects a connection when banning commits after API authentication', async () => {
    const actor = await user();
    const target = await user();
    const response = await pausedMutation(actor.id, 'connections', { userId: target.id }, () =>
      db.user.update({ where: { id: actor.id }, data: { accountStatus: 'BANNED' } }),
    );
    expect(response.status).toBe(403);
    expect(await db.connection.count({ where: { requesterId: actor.id } })).toBe(0);
  });
  it('rejects idea creation when suspension commits before the service starts', async () => {
    const actor = await user();
    const response = await pausedMutation(actor.id, 'ideas', ideaInput, () =>
      db.user.update({ where: { id: actor.id }, data: { accountStatus: 'SUSPENDED' } }),
    );
    const created = await db.idea.count({ where: { authorId: actor.id } });
    expect({ status: response.status, created }).toEqual({ status: 403, created: 0 });
    expect((await api(actor.id, 'state')).status).toBe(403);
  });
  it('rechecks organiser role before event creation', async () => {
    const actor = await user();
    await db.user.update({ where: { id: actor.id }, data: { role: 'ORGANISER' } });
    const response = await pausedMutation(
      actor.id,
      'events',
      {
        title: 'Synthetic event',
        description: 'Test only',
        category: 'Test',
        organizer: 'Test',
        location: 'Local',
        startsAt: '2027-01-01T10:00:00Z',
        url: 'https://example.test/',
      },
      () => db.user.update({ where: { id: actor.id }, data: { role: 'STUDENT' } }),
    );
    expect(response.status).toBe(403);
    expect(await db.event.count({ where: { ownerId: actor.id } })).toBe(0);
  });
  it('rechecks membership before sending an in-flight group message', async () => {
    const owner = await user();
    const member = await user();
    await connect(owner.id, member.id);
    const group = await service.createGroup(owner.id, {
      name: 'Race fixture',
      memberIds: [member.id],
    });
    const response = await pausedMutation(
      member.id,
      `conversations/${group.id}/messages`,
      { body: 'Must not persist', clientId: crypto.randomUUID() },
      () => service.manageGroup(owner.id, group.id, { action: 'remove', userId: member.id }),
    );
    expect(response.status).toBe(403);
    expect(await db.message.count({ where: { conversationId: group.id } })).toBe(0);
  });
});

describe('API bounds and identity isolation', () => {
  it('bounds authenticated search reads independently from other users and mutations', async () => {
    const actor = await user();
    const other = await user();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now());
    for (let i = 0; i < 240; i++)
      expect((await api(actor.id, 'colleges?search=Synthetic')).status).toBe(200);
    expect((await api(actor.id, 'colleges?search=Synthetic')).status).toBe(429);
    expect((await api(other.id, 'colleges?search=Synthetic')).status).toBe(200);
    expect((await api(actor.id, 'ideas', ideaInput)).status).toBe(200);
  });

  it.each(['-1', '10001', '1.5', 'Infinity', 'NaN'])(
    'rejects invalid discovery page %s',
    async (page) => {
      const actor = await user();
      expect((await api(actor.id, `state?page=${page}`)).status).toBe(400);
    },
  );
  it('allows 90 mutations and rejects the 91st in one bucket', async () => {
    const actor = await user();
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    for (let i = 0; i < 90; i++)
      expect((await api(actor.id, 'skips', {}, 'DELETE')).status).toBe(200);
    expect((await api(actor.id, 'skips', {}, 'DELETE')).status).toBe(429);
    const another = await user();
    expect((await api(another.id, 'skips', {}, 'DELETE')).status).toBe(200);
  });
  it('does not trust forged report actor, status or reviewer IDs', async () => {
    const actor = await user();
    const other = await user();
    const response = await api(actor.id, 'reports', {
      targetId: other.id,
      reporterId: other.id,
      reviewerId: actor.id,
      status: 'RESOLVED',
      reason: 'Synthetic complaint',
    });
    expect(response.status).toBe(200);
    const { id } = await response.json();
    expect(await db.report.findUnique({ where: { id } })).toMatchObject({
      reporterId: actor.id,
      reviewerId: null,
      status: 'OPEN',
    });
    expect(
      (await api(actor.id, `moderation/reports/${id}`, { status: 'RESOLVED' }, 'PATCH')).status,
    ).toBe(403);
  });
  it('does not allow a message cursor from another conversation', async () => {
    const owner = await user();
    const member = await user();
    await connect(owner.id, member.id);
    const one = await service.createGroup(owner.id, { name: 'One', memberIds: [member.id] });
    const two = await service.createGroup(owner.id, { name: 'Two', memberIds: [member.id] });
    const message = await service.sendMessage(owner.id, one.id, {
      body: 'Private fixture',
      clientId: crypto.randomUUID(),
    });
    expect(
      (await api(owner.id, `conversations/${two.id}/messages?before=${message.id}`)).status,
    ).toBe(400);
    const outsider = await user();
    expect((await api(outsider.id, `conversations/${one.id}/messages`)).status).toBe(403);
  });
  it('sets no-store on authenticated state', async () => {
    const actor = await user();
    expect((await api(actor.id, 'state')).headers.get('cache-control')).toBe('no-store');
  });
});

describe('additional image limits', () => {
  it('rejects non-canonical base64', async () => {
    await expect(decodeVerificationImage('data:image/png;base64,YR==')).rejects.toMatchObject({
      status: 400,
    });
  });
  it('rejects images above 20 megapixels', async () => {
    const bytes = await sharp({
      create: { width: 5001, height: 4000, channels: 3, background: '#fff' },
    })
      .png()
      .toBuffer();
    await expect(
      decodeVerificationImage(`data:image/png;base64,${bytes.toString('base64')}`),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('rejects animated WebP', async () => {
    const pixels = Buffer.concat([Buffer.alloc(12, 0), Buffer.alloc(12, 255)]);
    const bytes = await sharp(pixels, { raw: { width: 2, height: 4, channels: 3, pageHeight: 2 } })
      .webp({ loop: 0, delay: [100, 100] })
      .toBuffer();
    expect((await sharp(bytes).metadata()).pages).toBe(2);
    await expect(
      decodeVerificationImage(`data:image/webp;base64,${bytes.toString('base64')}`),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('service-boundary account revocation', () => {
  it.each([
    'request',
    'transition',
    'direct',
    'group-create',
    'group-manage',
    'group-clear',
    'message-send',
    'message-read',
    'message-delete',
    'idea-group',
    'resonate',
    'profile',
    'skip',
    'skip-clear',
    'block',
    'unblock',
    'event-save',
  ])('rejects %s after suspension with current transactional account state', async (operation) => {
    const actor = await user();
    const peer = await user();
    const other = await user();
    await connect(actor.id, peer.id);
    const pending = await service.requestConnection(actor.id, other.id);
    const group = await service.createGroup(actor.id, {
      name: 'Account status fixture',
      memberIds: [peer.id],
    });
    const idea = await service.createIdea(actor.id, ideaInput);
    const peerIdea = await service.createIdea(peer.id, ideaInput);
    const message = await service.sendMessage(actor.id, group.id, {
      body: 'Existing message',
      clientId: crypto.randomUUID(),
    });
    const event = await db.event.create({
      data: {
        title: 'Fixture event',
        description: 'Local only',
        category: 'Test',
        organizer: 'Test',
        location: 'Local',
        startsAt: new Date(),
        url: '',
      },
    });
    await db.user.update({ where: { id: actor.id }, data: { accountStatus: 'SUSPENDED' } });
    const actions: Record<string, () => Promise<unknown>> = {
      request: () => service.requestConnection(actor.id, other.id),
      transition: () => service.transitionConnection(actor.id, pending.id, 'cancel'),
      direct: () => service.directConversation(actor.id, peer.id),
      'group-create': () => service.createGroup(actor.id, { name: 'Denied', memberIds: [peer.id] }),
      'group-manage': () =>
        service.manageGroup(actor.id, group.id, { action: 'rename', value: 'Denied' }),
      'group-clear': () => service.clearConversation(actor.id, group.id),
      'message-send': () =>
        service.sendMessage(actor.id, group.id, { body: 'Denied', clientId: crypto.randomUUID() }),
      'message-read': () => service.readMessages(actor.id, group.id),
      'message-delete': () => service.deleteMessage(actor.id, group.id, message.id),
      'idea-group': () => service.getOrCreateIdeaGroup(actor.id, idea.id, []),
      resonate: () => service.resonate(actor.id, peerIdea.id, true),
      profile: () =>
        service.saveProfile(actor.id, {
          ...actor,
          degree: 'B.Tech',
          city: 'Jaipur',
          name: 'Denied',
        }),
      skip: () => service.skipStudent(actor.id, other.id),
      'skip-clear': () => service.clearSkips(actor.id),
      block: () => service.blockUser(actor.id, other.id),
      unblock: () => service.unblockUser(actor.id, other.id),
      'event-save': () => service.saveEvent(actor.id, event.id, true),
    };
    await expect(actions[operation]()).rejects.toMatchObject({ status: 403 });
    expect((await db.conversation.findUniqueOrThrow({ where: { id: group.id } })).name).toBe(
      'Account status fixture',
    );
    expect(await db.message.count({ where: { conversationId: group.id } })).toBe(1);
    expect((await db.user.findUniqueOrThrow({ where: { id: actor.id } })).name).toBe(actor.name);
  });
  it('rejects inactive connection targets and group invitees', async () => {
    const a = await user(),
      b = await user(),
      c = await user();
    await connect(a.id, b.id);
    await connect(a.id, c.id);
    const group = await service.createGroup(a.id, { name: 'Target status', memberIds: [c.id] });
    await db.user.update({ where: { id: b.id }, data: { accountStatus: 'BANNED' } });
    await expect(service.requestConnection(c.id, b.id)).rejects.toMatchObject({ status: 404 });
    await expect(
      service.createGroup(a.id, { name: 'Denied', memberIds: [b.id] }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.manageGroup(a.id, group.id, { action: 'add', userId: b.id }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
describe('live connection abuse bounds', () => {
  it('bounds SSE opens with shared database counters before allocating a stream', async () => {
    const actor = await user();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now());
    vi.mocked(authenticate).mockResolvedValue(actor);
    const { handleLiveRequest } = await import('@/backend/http/live-handler');
    for (let i = 0; i < 20; i++) {
      const response = await handleLiveRequest(new Request('http://localhost:3000/api/live'));
      expect(response.status).toBe(200);
      await response.body!.cancel();
    }
    expect((await handleLiveRequest(new Request('http://localhost:3000/api/live'))).status).toBe(
      429,
    );
  });
});
