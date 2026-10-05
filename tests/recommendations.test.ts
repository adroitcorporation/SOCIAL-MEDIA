import { beforeAll, beforeEach, afterAll, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { readdir, readFile } from 'node:fs/promises';
import {
  normalizeValue,
  normalizeList,
  taxonomy,
  desiredSkills,
  complementarySkills,
} from '@/shared/recommendations/taxonomy';
import { deterministicScore, balancedTeam, matchReasons } from '@/backend/recommendations/scoring';
import {
  DisabledProvider,
  CompatibleProvider,
  localInference,
  scrubPublicText,
  getProvider,
} from '@/backend/recommendations/provider';
import { profileSchema, profileSchemaForExisting } from '@/shared/contracts/schemas';
import type { db as Database } from '@/backend/database/client';
import type * as Recommendations from '@/backend/recommendations/service';
import type * as Worker from '@/backend/recommendations/worker';

let pg: PGlite,
  server: PGLiteSocketServer,
  db: typeof Database,
  recommend: typeof Recommendations,
  worker: typeof Worker;
const a = {
  skills: ['Web Development'],
  interests: ['Startups', 'FinTech'],
  lookingFor: ['UI/UX Designer'],
};
const b = {
  skills: ['UI/UX Design'],
  interests: ['Startups & Entrepreneurship', 'FinTech'],
  lookingFor: ['Web Developer'],
};
const vector = Array.from({ length: 384 }, (_, i) => (i === 0 ? 1 : 0));
const valid = {
  name: 'Student',
  college: 'LNMIIT',
  city: 'Jaipur',
  degree: 'B.Tech',
  graduationYear: 2028,
  bio: 'Building student projects.',
  domains: ['SaaS'],
  ...a,
};
beforeAll(async () => {
  pg = await PGlite.create();
  const root = 'src/backend/database/prisma/migrations';
  for (const d of (await readdir(root, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name)))
    await pg.exec(await readFile(`${root}/${d.name}/migration.sql`, 'utf8'));
  server = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 54339 });
  await server.start();
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@127.0.0.1:54339/postgres?connection_limit=1';
  ({ db } = await import('@/backend/database/client'));
  recommend = await import('@/backend/recommendations/service');
  worker = await import('@/backend/recommendations/worker');
});
beforeEach(async () => {
  vi.restoreAllMocks();
  delete process.env.AI_PROVIDER;
  delete process.env.RECOMMENDATIONS_ENABLED;
  await pg.exec(
    'TRUNCATE "User" CASCADE; TRUNCATE "RecommendationDocument", "RecommendationJob", "RecommendationInteraction";',
  );
  await db.user.createMany({
    data: [
      { id: 'a', name: 'A', college: 'LNMIIT', ...a },
      { id: 'b', name: 'B', college: 'JECRC University', ...b },
      {
        id: 'c',
        name: 'C',
        college: 'The LNM Institute of Information Technology Jaipur',
        skills: ['Web Development'],
        interests: ['Sports'],
        lookingFor: ['Networking'],
      },
    ].map((u) => ({ ...u, onboarded: true, city: 'Jaipur', collegeVerified: true })),
  });
});
afterAll(async () => {
  await db?.$disconnect();
  await server?.stop();
  await pg?.close();
});

it('normalizes skills, interests and intent independently and retains unknown selections', () => {
  expect(normalizeList('skills', ['UI UX', 'UX Design', 'ml', 'AI ML', 'Pottery'])).toEqual([
    'UI/UX Design',
    'AI / Machine Learning',
    'Pottery',
  ]);
  expect(normalizeValue('interests', 'AI')).toBe('Artificial Intelligence');
  expect(normalizeValue('lookingFor', 'co-founders')).toBe('Co-founder');
  expect(taxonomy.skills.length).toBeGreaterThanOrEqual(30);
  expect(taxonomy.skills.length).toBeLessThanOrEqual(40);
  expect(taxonomy.skills.map((s) => s.label)).not.toContain('React');
});
it('SQL normalization agrees with the shared taxonomy for every alias', async () => {
  for (const field of ['skills', 'interests', 'lookingFor'] as const) {
    const vals = taxonomy[field].flatMap((v) => [v.label, ...v.aliases]);
    const [row] = await db.$queryRaw<
      { values: string[] }[]
    >`SELECT fc_normalize(${field},${vals}::text[]) values`;
    expect(row.values.sort()).toEqual(normalizeList(field, vals).sort());
  }
});
it('rewards reciprocal intent above one-sided and identical skill matches', () => {
  expect(desiredSkills(['UX Designer'])).toContain('UI/UX Design');
  expect(complementarySkills(a.skills)).toContain('UI/UX Design');
  expect(deterministicScore(a, b)).toBeGreaterThan(deterministicScore(a, { ...b, lookingFor: [] }));
  expect(deterministicScore(a, b)).toBeGreaterThan(deterministicScore(a, a));
  expect(matchReasons(a, b)).toHaveLength(3);
  expect(matchReasons(a, b)[0]).toBe('Looking for your skills');
});
it('ranks a cross-college collaborator first with no embeddings or API credentials', async () => {
  const user = await db.user.findUniqueOrThrow({ where: { id: 'a' } });
  const result = await recommend.rankedProfiles(user);
  expect(result.students.map((u) => u.id)).toEqual(['b', 'c']);
  expect(result.total).toBe(2);
  expect(result.students[0].matchScore).toBeGreaterThan(60);
  expect(result.students[0].reasons.length).toBeLessThanOrEqual(3);
});
it('supports college aliases, city/state, same/other college and skill filters', async () => {
  const user = await db.user.findUniqueOrThrow({ where: { id: 'a' } });
  expect(
    (await recommend.rankedProfiles(user, new URLSearchParams('college=LNMIIT'))).students.map(
      (u) => u.id,
    ),
  ).toEqual(['c']);
  expect(
    (
      await recommend.rankedProfiles(
        user,
        new URLSearchParams('collegeScope=other&state=Rajasthan&city=Jaipur&skills=UI+UX'),
      )
    ).students.map((u) => u.id),
  ).toEqual(['b']);
  expect(
    (await recommend.rankedProfiles(user, new URLSearchParams('collegeScope=mine'))).students.map(
      (u) => u.id,
    ),
  ).toEqual(['c']);
});
it('finds catalog aliases without merging distinct Jaipur institutions', async () => {
  const { searchColleges } = await import('@/backend/recommendations/colleges');
  for (const alias of ['LNMIIT', 'MNIT', 'MUJ', 'SKIT', 'GIT Jaipur', 'VGU', 'JKLU'])
    expect((await searchColleges(alias)).length).toBeGreaterThan(0);
  expect((await searchColleges('JECRC')).map((c) => c.id).sort()).toEqual([
    'jecrc-foundation',
    'jecrc-university',
  ]);
  const rows = await db.college.findMany();
  expect(new Set(rows.map((c) => c.id)).size).toBe(rows.length);
});
it('excludes both block directions, inactive users, skips and existing requests', async () => {
  const user = await db.user.findUniqueOrThrow({ where: { id: 'a' } });
  await db.block.create({ data: { blockerId: 'b', blockedId: 'a' } });
  await db.skip.create({ data: { userId: 'a', targetId: 'c' } });
  expect((await recommend.rankedProfiles(user)).students).toEqual([]);
  await db.block.deleteMany();
  await db.skip.deleteMany();
  await db.user.update({ where: { id: 'b' }, data: { accountStatus: 'SUSPENDED' } });
  await db.connection.create({
    data: { requesterId: 'a', receiverId: 'c', pairKey: 'a:c', status: 'PENDING' },
  });
  expect((await recommend.rankedProfiles(user)).students).toEqual([]);
});
it('paginates stable ranking in SQL', async () => {
  await db.user.createMany({
    data: Array.from({ length: 28 }, (_, i) => ({
      id: `p${String(i).padStart(2, '0')}`,
      name: 'Student',
      onboarded: true,
    })),
  });
  const u = await db.user.findUniqueOrThrow({ where: { id: 'a' } });
  const first = await recommend.rankedProfiles(u),
    second = await recommend.rankedProfiles(u, new URLSearchParams('page=1'));
  expect(first.students).toHaveLength(12);
  expect(second.students).toHaveLength(12);
  expect(first.total).toBe(30);
  expect(first.students.some((a) => second.students.some((b) => a.id === b.id))).toBe(false);
});
it('stores separate inferred data and never rewrites explicit source selections', async () => {
  await db.user.update({
    where: { id: 'a' },
    data: { bio: 'Building SaaS products and looking for someone good at design.' },
  });
  await worker.processRecommendationJobs(5, new DisabledProvider());
  const doc = await db.recommendationDocument.findUniqueOrThrow({
    where: { kind_targetId: { kind: 'PROFILE', targetId: 'a' } },
  });
  expect(doc.inferred).toMatchObject({ domains: ['SaaS'], lookingFor: ['UI/UX Designer'] });
  expect(doc.embedding).toEqual([]);
  expect((await db.user.findUniqueOrThrow({ where: { id: 'a' } })).interests).toEqual(a.interests);
  expect(await db.recommendationJob.count()).toBe(0);
});
it('regenerates only relevant changes and retains custom data', async () => {
  await worker.processRecommendationJobs(5, new DisabledProvider());
  await db.user.update({
    where: { id: 'a' },
    data: { name: 'New name', photo: 'https://example.com/photo.png' },
  });
  expect(await db.recommendationJob.count()).toBe(0);
  await db.user.update({ where: { id: 'a' }, data: { skills: ['Pottery', 'React'] } });
  expect(await db.recommendationJob.count()).toBe(1);
  await worker.processRecommendationJobs(5, new DisabledProvider());
  const d = await db.recommendationDocument.findUniqueOrThrow({
    where: { kind_targetId: { kind: 'PROFILE', targetId: 'a' } },
  });
  expect(d.skills).toEqual(['Pottery', 'Web Development']);
});
it('stores validated embeddings, caches unchanged content and rejects incompatible models', async () => {
  const generateEmbedding = vi.fn(async () => vector);
  const provider = {
    model: 'test:384',
    generateEmbedding,
    extractStructuredProfile: async () => localInference(''),
    classifyContent: async () => localInference(''),
  };
  await worker.processRecommendationJobs(5, provider);
  expect(generateEmbedding).toHaveBeenCalledTimes(3);
  await db.recommendationJob.create({ data: { kind: 'PROFILE', targetId: 'a' } });
  await worker.processRecommendationJobs(1, provider);
  expect(generateEmbedding).toHaveBeenCalledTimes(3);
  const u = await db.user.findUniqueOrThrow({ where: { id: 'a' } });
  const before = (await recommend.rankedProfiles(u)).students[0].matchScore;
  await db.recommendationDocument.update({
    where: { kind_targetId: { kind: 'PROFILE', targetId: 'b' } },
    data: { embeddingModel: 'different-model' },
  });
  expect((await recommend.rankedProfiles(u)).students[0].matchScore).toBeLessThan(before);
});
it('falls back on provider failure and schedules bounded retries', async () => {
  const fail = {
    model: 'bad',
    generateEmbedding: async () => {
      throw new Error('SECRET MUST NOT BE LOGGED');
    },
    extractStructuredProfile: async () => localInference('SaaS'),
    classifyContent: async () => localInference(''),
  };
  const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
  await worker.processRecommendationJobs(1, fail);
  const job = await db.recommendationJob.findFirstOrThrow({ where: { attempts: 1 } });
  expect(job.lastError).toBe('provider_unavailable');
  expect(job.lockToken).toBeNull();
  expect(job.availableAt.getTime()).toBeGreaterThan(Date.now());
  expect(JSON.stringify(log.mock.calls)).not.toContain('SECRET');
  const u = await db.user.findUniqueOrThrow({ where: { id: 'a' } });
  expect((await recommend.rankedProfiles(u)).students.length).toBe(2);
});
it('rejects malformed provider output without persisting it', async () => {
  const provider = {
    model: 'bad',
    generateEmbedding: async () => [NaN],
    extractStructuredProfile: async () => ({
      skills: ['made-up'],
      interests: [],
      lookingFor: [],
      domains: [],
    }),
    classifyContent: async () => localInference(''),
  };
  await worker.processRecommendationJobs(1, provider);
  const doc = await db.recommendationDocument.findFirstOrThrow();
  expect(doc.embedding).toEqual([]);
  expect(JSON.stringify(doc.inferred)).not.toContain('made-up');
});
it('does not commit a stale enrichment result after an edit during processing', async () => {
  await db.recommendationJob.deleteMany({ where: { targetId: { not: 'a' } } });
  const provider = {
    model: 'test',
    generateEmbedding: async () => {
      await db.user.update({ where: { id: 'a' }, data: { skills: ['Video Editing'] } });
      return vector;
    },
    extractStructuredProfile: async () => localInference(''),
    classifyContent: async () => localInference(''),
  };
  await worker.processRecommendationJobs(1, provider);
  expect(await db.recommendationDocument.count({ where: { targetId: 'a' } })).toBe(0);
  expect((await db.recommendationJob.findFirstOrThrow()).version).toBe(2);
});
it('scrubs contact information and safely handles missing/malformed provider configuration', () => {
  const text = scrubPublicText('Email me@test.com or https://example.com, call 9876543210.');
  expect(text).not.toContain('me@test.com');
  expect(text).not.toContain('9876543210');
  expect(text).not.toContain('https://');
  expect(getProvider()).toBeInstanceOf(DisabledProvider);
  process.env.AI_PROVIDER = 'compatible';
  process.env.AI_API_KEY = 'test';
  process.env.AI_BASE_URL = 'not-url';
  process.env.EMBEDDING_MODEL = 'test';
  expect(getProvider()).toBeInstanceOf(DisabledProvider);
});
it('validates remote embedding dimensions and does not forward arbitrary extra fields', async () => {
  const fetcher = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify({ data: [{ embedding: [1, 2] }] })));
  const p = new CompatibleProvider('https://example.com/v1', 'test', 'test');
  await expect(p.generateEmbedding('test')).rejects.toThrow();
  expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({
    dimensions: 384,
    input: 'test',
  });
});
it('enforces new selection limits while allowing unchanged or reduced legacy lists', () => {
  const legacy = { ...valid, skills: Array.from({ length: 10 }, (_, i) => `custom-${i}`) };
  expect(profileSchema.safeParse(legacy).success).toBe(false);
  expect(profileSchemaForExisting(legacy).parse(legacy).skills).toEqual(legacy.skills);
  expect(
    profileSchemaForExisting(legacy).safeParse({
      ...legacy,
      skills: [...legacy.skills.slice(0, 8), 'new'],
    }).success,
  ).toBe(false);
  expect(
    profileSchemaForExisting(legacy).safeParse({ ...legacy, skills: legacy.skills.slice(0, 8) })
      .success,
  ).toBe(true);
  expect(profileSchema.safeParse({ ...valid, lookingFor: ['a', 'b', 'c', 'd', 'e'] }).success).toBe(
    false,
  );
});
it('ranks relevant ideas while allowing recent ideas above stale popular ones', async () => {
  await db.idea.createMany({
    data: [
      {
        id: 'new',
        authorId: 'b',
        title: 'FinTech app',
        description: 'New project',
        category: 'FinTech',
        skills: ['React'],
        tags: ['FinTech'],
      },
      {
        id: 'old',
        authorId: 'c',
        title: 'Old',
        description: 'Sports',
        category: 'Sports',
        skills: [],
        tags: [],
        createdAt: new Date('2020-01-01'),
      },
    ],
  });
  const u = await db.user.findUniqueOrThrow({ where: { id: 'a' } });
  expect((await recommend.recommendedFeedIds(u, 'IDEA', new URLSearchParams()))[0].id).toBe('new');
  expect(
    (await recommend.getRecommendedUsersForIdea('a', 'new')).students.some((u) => u.id === 'b'),
  ).toBe(false);
});
it('balances teams for uncovered skills instead of returning only developers', async () => {
  await db.user.create({
    data: { id: 'designer2', name: 'Second designer', skills: ['UI/UX Design'], onboarded: true },
  });
  const team = await recommend.recommendTeam('a', {
    requiredSkills: ['UI/UX', 'Web Development'],
    teamSize: 2,
  });
  expect(team.coveredSkills.sort()).toEqual(['UI/UX Design', 'Web Development']);
  expect(team.missingSkills).toEqual([]);
  expect(team.users).toHaveLength(2);
  expect(
    balancedTeam(
      [
        { ...a, id: 'a', matchScore: 99 },
        { ...a, id: 'c', matchScore: 98 },
        { ...b, id: 'b', matchScore: 30 },
      ],
      ['Web Development', 'UI/UX Design'],
      2,
    ).users.map((u) => u.id),
  ).toEqual(['a', 'b']);
});
it('keeps a rare required skill in the bounded team shortlist', async () => {
  await db.user.createMany({
    data: Array.from({ length: 90 }, (_, i) => ({
      id: `designer-${i}`,
      name: 'Designer',
      ...b,
      onboarded: true,
    })),
  });
  await db.user.update({
    where: { id: 'c' },
    data: { skills: ['Acting'], interests: [], lookingFor: [] },
  });
  const team = await recommend.recommendTeam('a', {
    requiredSkills: ['UI/UX Design', 'Acting'],
    teamSize: 2,
  });
  expect(team.missingSkills).toEqual([]);
  expect(team.users.some((u) => u.id === 'c')).toBe(true);
});
it('recovers an expired lease and stops after the configured retry budget', async () => {
  await db.recommendationJob.deleteMany({ where: { targetId: { not: 'a' } } });
  await db.recommendationJob.update({
    where: { kind_targetId: { kind: 'PROFILE', targetId: 'a' } },
    data: { lockToken: 'abandoned', lockedUntil: new Date(0), attempts: 3 },
  });
  const fail = {
    model: 'bad',
    generateEmbedding: vi.fn(async () => {
      throw new Error('offline');
    }),
    extractStructuredProfile: async () => localInference(''),
    classifyContent: async () => localInference(''),
  };
  await worker.processRecommendationJobs(1, fail);
  expect((await db.recommendationJob.findFirstOrThrow()).attempts).toBe(4);
  await db.recommendationJob.updateMany({ data: { availableAt: new Date(0) } });
  expect(await worker.processRecommendationJobs(1, fail)).toBe(0);
  expect(fail.generateEmbedding).toHaveBeenCalledTimes(1);
});
it('returns a bounded page from a thousand profiles without provider calls', async () => {
  await db.user.createMany({
    data: Array.from({ length: 997 }, (_, i) => ({
      id: `scale-${i}`,
      name: `Student ${i}`,
      onboarded: true,
      ...(i % 2 ? a : b),
    })),
  });
  const provider = vi.spyOn(globalThis, 'fetch');
  const started = performance.now();
  const result = await recommend.rankedProfiles(
    await db.user.findUniqueOrThrow({ where: { id: 'a' } }),
  );
  expect(result.total).toBe(999);
  expect(result.students).toHaveLength(12);
  expect(provider).not.toHaveBeenCalled();
  console.info(
    JSON.stringify({
      event: 'recommendation_1000_fixture',
      durationMs: Math.round(performance.now() - started),
    }),
  );
});
it('ranks a hackathon for a developer without requiring an LLM or embeddings', async () => {
  const date = new Date(Date.now() + 7 * 86400000);
  await db.event.createMany({
    data: ['Hackathon', 'Sports'].map((category) => ({
      id: category,
      title: category,
      description: category,
      category,
      organizer: 'Club',
      location: 'Online',
      url: '',
      startsAt: date,
    })),
  });
  const u = await db.user.findUniqueOrThrow({ where: { id: 'a' } });
  expect((await recommend.recommendedFeedIds(u, 'EVENT', new URLSearchParams()))[0].id).toBe(
    'Hackathon',
  );
});
it('deduplicates interaction events and rejects tracking a blocked profile', async () => {
  const { recordProfileOpen } = await import('@/backend/recommendations/interactions');
  await recordProfileOpen('a', { targetId: 'b', action: 'PROFILE_OPENED' });
  await recordProfileOpen('a', { targetId: 'b', action: 'PROFILE_OPENED' });
  expect(await db.recommendationInteraction.count()).toBe(1);
  await db.block.create({ data: { blockerId: 'a', blockedId: 'b' } });
  await expect(
    recordProfileOpen('a', { targetId: 'b', action: 'PROFILE_OPENED' }),
  ).rejects.toMatchObject({ status: 404 });
});
it('requires authentication for each new endpoint', async () => {
  const auth = await import('@/backend/auth/session');
  const { AppError } = await import('@/backend/utils/errors');
  vi.spyOn(auth, 'authenticate').mockRejectedValue(new AppError(401, 'Sign in'));
  const { handleApiRequest } = await import('@/backend/http/api-handler');
  for (const [path, method] of [
    ['recommendations/people', 'GET'],
    ['recommendations/team', 'POST'],
    ['recommendations/ideas/new', 'GET'],
    ['recommendations/interactions', 'POST'],
    ['colleges', 'GET'],
  ]) {
    const response = await handleApiRequest(
      new Request(`http://localhost/api/${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(method === 'POST' ? { body: '{}' } : {}),
      }),
      path.split('/'),
    );
    expect(response.status).toBe(401);
  }
});
it('prevents suggestions for blocked idea authors and returns no inactive team members', async () => {
  await db.idea.create({
    data: {
      id: 'idea',
      authorId: 'b',
      title: 'Idea',
      description: 'Project',
      category: 'Technology',
      skills: ['UI/UX Design'],
      tags: [],
    },
  });
  await db.block.create({ data: { blockerId: 'b', blockedId: 'a' } });
  await expect(recommend.getRecommendedUsersForIdea('a', 'idea')).rejects.toMatchObject({
    status: 404,
  });
  await db.user.update({ where: { id: 'c' }, data: { accountStatus: 'BANNED' } });
  expect(
    (await recommend.recommendTeam('a', { requiredSkills: ['Web Development'] })).users,
  ).toEqual([]);
});
it('protects internal recommendation tables with RLS and cleans up deleted targets', async () => {
  const rows = await db.$queryRaw<
    { relrowsecurity: boolean }[]
  >`SELECT relrowsecurity FROM pg_class WHERE relname IN ('College','RecommendationDocument','RecommendationJob','RecommendationInteraction','TaxonomyAlias','RecommendationSkillLink')`;
  expect(rows).toHaveLength(6);
  expect(rows.every((r) => r.relrowsecurity)).toBe(true);
  await worker.processRecommendationJobs(5, new DisabledProvider());
  await db.user.delete({ where: { id: 'b' } });
  expect(await db.recommendationDocument.count({ where: { targetId: 'b' } })).toBe(0);
});
