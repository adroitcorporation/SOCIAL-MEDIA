import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { readFile, readdir } from 'node:fs/promises';
import sharp from 'sharp';
import type * as Services from '@/backend/services/community';
import type { db as Database } from '@/backend/database/client';
import type { handleApiRequest as Handler } from '@/backend/http/api-handler';
import { authenticate } from '@/backend/auth/session';
import { decodeVerificationImage } from '@/backend/services/verification-image';
import { MAX_VERIFICATION_IMAGE_BYTES } from '@/shared/contracts/verification';
let eventService: typeof import('@/backend/services/events');
let moderationService: typeof import('@/backend/services/moderation');
vi.mock('@/backend/auth/session', () => ({ authenticate: vi.fn(), isLocalDemo: () => false }));
let pg: PGlite;
let server: PGLiteSocketServer;
let db: typeof Database;
let service: typeof Services;
let handle: typeof Handler;
let sequence = 0;
const email = { method: 'EMAIL', collegeEmail: 'student@college.edu' };
async function student() {
  return db.user.create({ data: { id: `applicant-${++sequence}`, name: 'New student' } });
}
async function api(userId: string, path: string, body?: unknown, method = 'POST') {
  vi.mocked(authenticate).mockResolvedValue(
    await db.user.findUniqueOrThrow({ where: { id: userId } }),
  );
  return handle(
    new Request(`http://localhost:3000/api/${path}`, {
      method: body === undefined ? 'GET' : method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    path.split('/'),
  );
}
beforeAll(async () => {
  pg = await PGlite.create();
  const directory = 'src/backend/database/prisma/migrations';
  for (const name of (await readdir(directory, { withFileTypes: true }))
    .filter((item) => item.isDirectory())
    .map((item) => item.name)
    .sort())
    await pg.exec(await readFile(`${directory}/${name}/migration.sql`, 'utf8'));
  server = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 54332 });
  await server.start();
  vi.stubEnv(
    'DATABASE_URL',
    'postgresql://postgres:postgres@127.0.0.1:54332/postgres?connection_limit=1',
  );

  vi.stubEnv('APP_URL', 'http://localhost:3000');
  ({ db } = await import('@/backend/database/client'));
  service = await import('@/backend/services/community');
  eventService = await import('@/backend/services/events');
  moderationService = await import('@/backend/services/moderation');
  ({ handleApiRequest: handle } = await import('@/backend/http/api-handler'));
  for (const id of ['reviewer', 'second-reviewer', 'target'])
    await db.user.create({
      data: {
        id,
        name: id,
        onboarded: true,
        role: id.includes('reviewer') ? 'MODERATOR' : 'STUDENT',
      },
    });
});

describe('database-backed role and moderation enforcement', () => {
  const event = {
    title: 'Community workshop',
    description: 'Build together at campus.',
    category: 'Workshop',
    organizer: 'Campus team',
    location: 'Auditorium',
    startsAt: '2027-01-01T10:00:00.000Z',
    url: 'https://example.com/event',
  };
  beforeAll(async () => {
    for (const [id, role] of [
      ['organiser', 'ORGANISER'],
      ['other-organiser', 'ORGANISER'],
      ['ultimate', 'ULTIMATE_MODERATOR'],
    ] as const)
      await db.user.create({ data: { id, name: id, role } });
  });
  it('organisers create and manage only owned events, ignoring forged ownership and roles', async () => {
    const created = await api('organiser', 'events', {
      ...event,
      ownerId: 'other-organiser',
      role: 'ULTIMATE_MODERATOR',
    });
    expect(created.status).toBe(200);
    const owned = await created.json();
    expect(owned.ownerId).toBe('organiser');
    expect((await api('other-organiser', `events/${owned.id}`, event, 'PATCH')).status).toBe(403);
    expect((await api('other-organiser', `events/${owned.id}`, {}, 'DELETE')).status).toBe(403);
    expect(
      (
        await api(
          'organiser',
          `events/${owned.id}`,
          { ...event, title: 'Updated', ownerId: 'other-organiser' },
          'PATCH',
        )
      ).status,
    ).toBe(200);
    expect((await db.event.findUniqueOrThrow({ where: { id: owned.id } })).ownerId).toBe(
      'organiser',
    );
    const ownList = await (await api('organiser', 'events/managed')).json();
    expect(ownList.map((item: { id: string }) => item.id)).toContain(owned.id);
    expect(await (await api('other-organiser', 'events/managed')).json()).toEqual([]);
    expect((await api('organiser', `events/${owned.id}`, {}, 'DELETE')).status).toBe(200);
  });
  it('moderators cannot create, edit or delete events; ultimate moderators can manage any event', async () => {
    const owned = await eventService.createEvent('organiser', event);
    expect((await api('reviewer', 'events', event)).status).toBe(403);
    expect((await api('reviewer', `events/${owned.id}`, event, 'PATCH')).status).toBe(403);
    expect((await api('reviewer', `events/${owned.id}`, {}, 'DELETE')).status).toBe(403);
    await expect(eventService.deleteEvent('other-organiser', owned.id)).rejects.toMatchObject({
      status: 403,
    });
    expect((await api('ultimate', `events/${owned.id}`, event, 'PATCH')).status).toBe(200);
    expect((await api('ultimate', `events/${owned.id}`, {}, 'DELETE')).status).toBe(200);
    expect((await api('ultimate', 'events', event)).status).toBe(200);
  });
  it('organisers cannot access moderation data or verification reviews, even on direct service calls', async () => {
    const applicant = await student();
    const verification = await service.submitVerification(applicant.id, email);
    for (const path of [
      'moderation/verifications',
      'moderation/dashboard',
      'moderation/reports',
      'moderation/users',
      'moderation/roles',
      'moderation/access',
    ])
      expect((await api('organiser', path)).status).toBe(403);
    expect(
      (
        await api(
          'organiser',
          `moderation/verifications/${verification.id}`,
          { status: 'APPROVED' },
          'PATCH',
        )
      ).status,
    ).toBe(403);
    await expect(
      service.reviewVerification('organiser', verification.id, { status: 'APPROVED' }),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      (
        await api(
          'reviewer',
          `moderation/verifications/${verification.id}`,
          { status: 'APPROVED', reviewNote: 'Confirmed college.' },
          'PATCH',
        )
      ).status,
    ).toBe(200);
  });
  it('only ultimate moderators assign roles and the last active ultimate is protected', async () => {
    const target = await student();
    const input = { role: 'ORGANISER', reason: 'Approved event organiser.' };
    for (const actor of [target.id, 'organiser', 'reviewer']) {
      expect((await api(actor, `moderation/users/${target.id}/role`, input, 'PATCH')).status).toBe(
        403,
      );
      expect((await api(actor, 'moderation/roles')).status).toBe(403);
    }
    expect(
      (await api('ultimate', `moderation/users/${target.id}/role`, input, 'PATCH')).status,
    ).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: target.id } })).role).toBe('ORGANISER');
    expect(
      (
        await api(
          'ultimate',
          'moderation/users/ultimate/role',
          { role: 'STUDENT', reason: 'Retire' },
          'PATCH',
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await api(
          'ultimate',
          'moderation/users/ultimate/status',
          { accountStatus: 'BANNED', reason: 'Retire' },
          'PATCH',
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await api(
          'reviewer',
          'moderation/users/ultimate/status',
          { accountStatus: 'BANNED', reason: 'Override' },
          'PATCH',
        )
      ).status,
    ).toBe(403);
    await expect(
      moderationService.changeUser('reviewer', target.id, input, 'role'),
    ).rejects.toMatchObject({ status: 403 });
  });
  it.each(['SUSPENDED', 'BANNED', 'RESTRICTED', 'DEACTIVATED'])(
    'moderators can set %s and existing identities immediately lose all app access',
    async (accountStatus) => {
      const target = await db.user.create({
        data: { id: `restricted-${accountStatus}`, name: 'Restricted account', role: 'ORGANISER' },
      });
      expect(
        (
          await api(
            'reviewer',
            `moderation/users/${target.id}/status`,
            { accountStatus, reason: 'Community policy violation.' },
            'PATCH',
          )
        ).status,
      ).toBe(200);
      for (const path of ['state', 'session', 'events/managed', 'verification', 'students/target'])
        expect((await api(target.id, path)).status).toBe(403);
      expect((await api(target.id, 'events', event)).status).toBe(403);
      expect((await api(target.id, 'connections', { userId: 'target' })).status).toBe(403);
      await expect(eventService.createEvent(target.id, event)).rejects.toMatchObject({
        status: 403,
      });
      expect(
        (
          await api(
            'reviewer',
            `moderation/users/${target.id}/status`,
            { accountStatus: 'ACTIVE', reason: 'Appeal approved.' },
            'PATCH',
          )
        ).status,
      ).toBe(200);
      expect((await api(target.id, 'state')).status).toBe(200);
    },
  );
  it('users submit reports; only moderators review them; all decisions are audited', async () => {
    const reporter = await student();
    const response = await api(reporter.id, 'reports', {
      targetId: 'organiser',
      reason: 'Repeated inappropriate messages.',
      reporterId: 'ultimate',
      status: 'DISMISSED',
    });
    expect(response.status).toBe(200);
    const report = await response.json();
    expect(await db.report.findUnique({ where: { id: report.id } })).toMatchObject({
      reporterId: reporter.id,
      status: 'OPEN',
    });
    expect(
      (
        await api(reporter.id, 'reports', {
          targetId: 'organiser',
          reason: 'Repeated inappropriate messages.',
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await api(
          reporter.id,
          `moderation/reports/${report.id}`,
          { status: 'DISMISSED', reviewNote: 'Tampered' },
          'PATCH',
        )
      ).status,
    ).toBe(403);
    for (const status of ['REVIEWED', 'ESCALATED', 'RESOLVED', 'DISMISSED'])
      expect(
        (
          await api(
            'reviewer',
            `moderation/reports/${report.id}`,
            { status, reviewNote: 'Investigated by moderator.' },
            'PATCH',
          )
        ).status,
      ).toBe(200);
    expect(await db.moderationAction.count({ where: { targetId: report.id } })).toBe(4);
    expect(await db.report.findUnique({ where: { id: report.id } })).toMatchObject({
      reviewerId: 'reviewer',
      reviewedAt: expect.any(Date),
    });
    const dashboard = await (await api('ultimate', 'moderation/dashboard')).json();
    expect(dashboard.metrics.totalReports).toBeGreaterThan(0);
    expect(dashboard.metrics.totalEvents).toBe(await db.event.count());
    expect(dashboard.activity.length).toBeGreaterThan(0);
  });
  it('rejects unauthenticated callers and ignores the retired environment allowlist', async () => {
    // Use the real error type for the HTTP error adapter.
    const { AppError } = await import('@/backend/utils/errors');
    vi.mocked(authenticate).mockReset().mockRejectedValueOnce(new AppError(401, 'Sign in'));
    expect(
      (
        await handle(new Request('http://localhost:3000/api/moderation/dashboard'), [
          'moderation',
          'dashboard',
        ])
      ).status,
    ).toBe(401);
    vi.stubEnv('MODERATOR_USER_IDS', 'organiser');
    expect((await api('organiser', 'moderation/dashboard')).status).toBe(403);
  });
});
afterAll(async () => {
  await db?.$disconnect();
  await server?.stop();
  await pg?.close();
  vi.unstubAllEnvs();
});

describe('college verification workflow', () => {
  it('blocks new connections until moderator approval, including attempts to set approval in a submission', async () => {
    const user = await student();
    await expect(service.requestConnection(user.id, 'target')).rejects.toMatchObject({
      status: 403,
    });
    const submitted = await api(user.id, 'verification', {
      ...email,
      status: 'APPROVED',
      reviewerId: user.id,
    });
    expect(submitted.status).toBe(200);
    const pending = await submitted.json();
    expect(pending).toMatchObject({
      status: 'PENDING',
      userId: user.id,
      reviewerId: null,
      reviewedAt: null,
    });
    await expect(service.requestConnection(user.id, 'target')).rejects.toMatchObject({
      status: 403,
    });
    const review = await api(
      'reviewer',
      `moderation/verifications/${pending.id}`,
      { status: 'APPROVED', reviewNote: 'College confirmed.' },
      'PATCH',
    );
    expect(review.status).toBe(200);
    expect(await review.json()).toMatchObject({
      status: 'APPROVED',
      reviewerId: 'reviewer',
      reviewNote: 'College confirmed.',
      reviewedAt: expect.any(String),
    });
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).collegeVerified).toBe(
      true,
    );
    expect((await service.requestConnection(user.id, 'target')).status).toBe('PENDING');
    await expect(service.submitVerification(user.id, email)).rejects.toMatchObject({ status: 409 });
  });
  it('rejects with a note, keeps connections locked, and allows another submission', async () => {
    const user = await student();
    const pending = await service.submitVerification(user.id, email);
    const response = await api(
      'reviewer',
      `moderation/verifications/${pending.id}`,
      { status: 'REJECTED', reviewNote: 'Please provide a clearer ID.' },
      'PATCH',
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'REJECTED',
      reviewNote: 'Please provide a clearer ID.',
    });
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).collegeVerified).toBe(
      false,
    );
    await expect(service.requestConnection(user.id, 'target')).rejects.toMatchObject({
      status: 403,
    });
    const retry = await service.submitVerification(user.id, email);
    expect(retry.id).not.toBe(pending.id);
    expect(retry.status).toBe('PENDING');
    expect(await db.collegeVerificationRequest.count({ where: { userId: user.id } })).toBe(2);
  });
  it('does not revoke domain verification when rejecting an older pending submission', async () => {
    const user = await student();
    const pending = await service.submitVerification(user.id, email);
    await db.user.update({
      where: { id: user.id },
      data: { emailVerified: true, collegeVerified: true },
    });
    await service.reviewVerification('reviewer', pending.id, {
      status: 'REJECTED',
      reviewNote: 'Already verified by college email.',
    });
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).collegeVerified).toBe(
      true,
    );
  });
  it('denies non-moderators list, review and private image APIs and service calls', async () => {
    const user = await student();
    const pending = await service.submitVerification(user.id, email);
    for (const [path, body] of [
      ['moderation/verifications', undefined],
      [`moderation/verifications/${pending.id}`, { status: 'APPROVED' }],
      [`moderation/verifications/${pending.id}/document`, undefined],
    ] as const)
      expect((await api(user.id, path, body, 'PATCH')).status).toBe(403);
    await expect(service.listVerificationRequests(user.id)).rejects.toMatchObject({ status: 403 });
    await expect(
      service.reviewVerification(user.id, pending.id, { status: 'APPROVED' }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(service.verificationDocument(user.id, pending.id)).rejects.toMatchObject({
      status: 403,
    });
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).collegeVerified).toBe(
      false,
    );
  });
  it('allows only one pending submission and one review decision, even for simultaneous requests', async () => {
    const user = await student();
    const results = await Promise.allSettled([
      service.submitVerification(user.id, email),
      service.submitVerification(user.id, email),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const pending = await service.latestVerification(user.id);
    const decisions = await Promise.allSettled([
      service.reviewVerification('reviewer', pending!.id, { status: 'APPROVED' }),
      service.reviewVerification('second-reviewer', pending!.id, { status: 'REJECTED' }),
    ]);
    expect(decisions.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const final = await service.latestVerification(user.id);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).collegeVerified).toBe(
      final!.status === 'APPROVED',
    );
  });
  it('lets an incomplete, unverified account browse and use ideas and existing messages', async () => {
    const user = await student();
    expect((await api(user.id, 'state')).status).toBe(200);
    expect((await api(user.id, 'students/target')).status).toBe(200);
    const ideaResponse = await api(user.id, 'ideas', {
      title: 'Open collaboration',
      description: 'Build together.',
      category: 'Technology',
      skills: ['React'],
      tags: [],
    });
    expect(ideaResponse.status).toBe(200);
    const idea = await ideaResponse.json();
    await service.resonate('target', idea.id, true);
    const group = await service.getOrCreateIdeaGroup(user.id, idea.id, ['target']);
    expect(
      (
        await api(user.id, `conversations/${group.id}/messages`, {
          body: 'Hello team',
          clientId: crypto.randomUUID(),
        })
      ).status,
    ).toBe(200);
    expect((await api(user.id, `conversations/${group.id}/messages`)).status).toBe(200);
  });
  it.each(['jpeg', 'png', 'webp'] as const)(
    'stores a real %s ID privately and returns it only to moderators',
    async (format) => {
      const user = await student();
      const bytes = await sharp({
        create: { width: 2, height: 2, channels: 3, background: '#123456' },
      })
        .toFormat(format)
        .toBuffer();
      const submitted = await api(user.id, 'verification', {
        method: 'COLLEGE_ID',
        documentUrl: `data:image/${format};base64,${bytes.toString('base64')}`,
      });
      expect(submitted.status).toBe(200);
      const request = await submitted.json();
      expect(request).not.toHaveProperty('documentBytes');
      expect(request).not.toHaveProperty('documentUrl');
      const state = await (await api(user.id, 'state')).json();
      expect(state.verification).not.toHaveProperty('documentBytes');
      expect(state.verification).not.toHaveProperty('documentUrl');
      const list = await (await api('reviewer', 'moderation/verifications')).json();
      expect(list.find((item: { id: string }) => item.id === request.id)).not.toHaveProperty(
        'documentBytes',
      );
      const image = await api('reviewer', `moderation/verifications/${request.id}/document`);
      expect(image.status).toBe(200);
      expect(image.headers.get('content-type')).toBe(`image/${format}`);
      expect(image.headers.get('cache-control')).toContain('no-store');
      expect((await sharp(Buffer.from(await image.arrayBuffer())).metadata()).format).toBe(format);
    },
  );
  it('rejects invalid content, MIME mismatches, unsupported formats and oversized files', async () => {
    const user = await student();
    for (const documentUrl of [
      'https://example.test/id.png',
      'data:image/svg+xml;base64,PHN2Zz4=',
      'data:image/png;base64,bm90LWFuLWltYWdl',
    ])
      expect(
        (await api(user.id, 'verification', { method: 'COLLEGE_ID', documentUrl })).status,
      ).toBe(400);
    const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: '#fff' } })
      .png()
      .toBuffer();
    await expect(
      decodeVerificationImage(`data:image/jpeg;base64,${png.toString('base64')}`),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      decodeVerificationImage(
        `data:image/png;base64,${Buffer.alloc(MAX_VERIFICATION_IMAGE_BYTES + 1).toString('base64')}`,
      ),
    ).rejects.toMatchObject({ status: 413 });
    expect(await db.collegeVerificationRequest.count({ where: { userId: user.id } })).toBe(0);
  });
});
