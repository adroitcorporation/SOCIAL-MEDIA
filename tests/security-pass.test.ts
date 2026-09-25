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
afterAll(async () => {
  await db?.$disconnect();
  await server?.stop();
  await pg?.close();
  vi.unstubAllEnvs();
});

describe('block privacy regressions', () => {
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
