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
  vi.stubEnv('MODERATOR_USER_IDS', ' reviewer , second-reviewer ');
  vi.stubEnv('APP_URL', 'http://localhost:3000');
  ({ db } = await import('@/backend/database/client'));
  service = await import('@/backend/services/community');
  ({ handleApiRequest: handle } = await import('@/backend/http/api-handler'));
  for (const id of ['reviewer', 'second-reviewer', 'target'])
    await db.user.create({ data: { id, name: id, onboarded: true } });
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
