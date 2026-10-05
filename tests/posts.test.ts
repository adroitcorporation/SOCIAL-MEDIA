import { beforeAll, beforeEach, afterAll, afterEach, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { readdir, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { authenticate } from '@/backend/auth/session';
import { DisabledProvider, localInference } from '@/backend/recommendations/provider';
import { ranking } from '@/backend/recommendations/config';
import { postLimits } from '@/shared/contracts/posts';
import type { db as Database } from '@/backend/database/client';
import type * as Posts from '@/backend/services/posts';
import type * as Worker from '@/backend/recommendations/worker';
import type * as Recommendations from '@/backend/recommendations/service';
import type { handleApiRequest as Handler } from '@/backend/http/api-handler';

vi.mock('@/backend/auth/session', () => ({ authenticate: vi.fn(), isLocalDemo: () => false }));
let pg: PGlite, server: PGLiteSocketServer, db: typeof Database, posts: typeof Posts, worker: typeof Worker, recommendations: typeof Recommendations, handle: typeof Handler;
const input = (content = 'Building a campus project.', visibility: 'PUBLIC' | 'CONNECTIONS_ONLY' = 'PUBLIC') => ({ content, visibility, clientId: randomUUID() });
beforeAll(async () => {
  pg = await PGlite.create();
  const root = 'src/backend/database/prisma/migrations';
  for (const directory of (await readdir(root, { withFileTypes: true })).filter((d) => d.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) await pg.exec(await readFile(`${root}/${directory.name}/migration.sql`, 'utf8'));
  server = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 54341 });
  await server.start();
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:54341/postgres?connection_limit=1';
  ({ db } = await import('@/backend/database/client'));
  posts = await import('@/backend/services/posts');
  worker = await import('@/backend/recommendations/worker');
  recommendations = await import('@/backend/recommendations/service');
  ({ handleApiRequest: handle } = await import('@/backend/http/api-handler'));
});
beforeEach(async () => {
  vi.restoreAllMocks();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('No external requests in tests')));
  vi.stubEnv('AI_PROVIDER', 'disabled');
  vi.stubEnv('APP_URL', 'http://localhost:3000');
  await pg.exec('TRUNCATE "User" CASCADE; TRUNCATE "RecommendationJob", "RecommendationDocument", "RecommendationInteraction", "RateLimit";');
  for (const [id, skills] of [['a', ['Web Development']], ['b', ['Video Editing']], ['c', ['UI/UX Design']]] as const) await db.user.create({ data: { id, name: id, college: 'Test College', onboarded: true, skills: [...skills] } });
  await db.recommendationJob.deleteMany();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
afterAll(async () => { await db?.$disconnect(); await server?.stop(); await pg?.close(); });
async function api(actor: string, path: string, body?: unknown, method = 'POST') {
  vi.mocked(authenticate).mockResolvedValue(await db.user.findUniqueOrThrow({ where: { id: actor } }));
  return handle(new Request(`http://localhost:3000/api/${path}`, { method: body === undefined ? 'GET' : method, headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' }, body: body === undefined ? undefined : JSON.stringify(body) }), path.split('?')[0].split('/'));
}

it('creates, edits and deletes through the authenticated API without trusting authors or counts', async () => {
  const create = await api('a', 'posts', input());
  expect(create.status).toBe(200);
  const post = await create.json();
  expect(post.author.id).toBe('a');
  expect(post).not.toHaveProperty('clientId');
  expect((await api('a', `posts/${post.id}`, { content: 'Edited', visibility: 'PUBLIC' }, 'PATCH')).status).toBe(200);
  expect((await posts.getPost('b', post.id)).content).toBe('Edited');
  expect((await api('a', 'posts', { ...input(), authorId: 'b', likeCount: 999 })).status).toBe(400);
  expect((await api('a', `posts/${post.id}`, {}, 'DELETE')).status).toBe(200);
  await expect(posts.getPost('a', post.id)).rejects.toMatchObject({ status: 404 });
});
it('rejects unauthenticated requests and invalid origins', async () => {
  vi.mocked(authenticate).mockRejectedValue(Object.assign(new Error('Sign in'), { status: 401 }));
  expect((await handle(new Request('http://localhost:3000/api/posts/unknown'), ['posts', 'unknown'])).status).not.toBe(200);
  expect((await handle(new Request('http://localhost:3000/api/posts', { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: JSON.stringify(input()) }), ['posts'])).status).toBe(403);
});
it('rejects editing and deleting someone else’s posts or comments', async () => {
  const post = await posts.createPost('a', input());
  expect((await api('b', `posts/${post.id}`, { content: 'Hijacked' }, 'PATCH')).status).toBe(403);
  expect((await api('b', `posts/${post.id}`, {}, 'DELETE')).status).toBe(403);
  const comment = await posts.createComment('b', post.id, { content: 'Hello', clientId: randomUUID() });
  await expect(posts.deleteComment('a', post.id, comment.id)).rejects.toMatchObject({ status: 403 });
});
it('restricts connections-only posts, including their comments and interactions', async () => {
  const p = await posts.createPost('a', input('Private update', 'CONNECTIONS_ONLY'));
  expect((await posts.listPosts('a', 'a')).items).toHaveLength(1);
  expect((await posts.listPosts('b', 'a')).items).toHaveLength(0);
  for (const action of [() => posts.getPost('b', p.id), () => posts.likePost('b', p.id, { enabled: true }), () => posts.listComments('b', p.id), () => posts.createComment('b', p.id, { content: 'Hi', clientId: randomUUID() }), () => posts.reportPost('b', p.id, { reason: 'Spam' })]) await expect(action()).rejects.toMatchObject({ status: 404 });
  await db.connection.create({ data: { requesterId: 'b', receiverId: 'a', pairKey: 'a:b', status: 'ACCEPTED' } });
  expect((await posts.getPost('b', p.id)).id).toBe(p.id);
  await db.connection.updateMany({ data: { status: 'CANCELLED' } });
  await expect(posts.getPost('b', p.id)).rejects.toMatchObject({ status: 404 });
  expect(await db.recommendationJob.count()).toBe(0);
});
it.each([['a', 'b'], ['b', 'a']])('respects block direction %s → %s', async (blockerId, blockedId) => {
  const post = await posts.createPost('a', input());
  await db.block.create({ data: { blockerId, blockedId } });
  await expect(posts.listPosts('b', 'a')).rejects.toMatchObject({ status: 404 });
  await expect(posts.getPost('b', post.id)).rejects.toMatchObject({ status: 404 });
  await expect(posts.likePost('b', post.id, { enabled: true })).rejects.toMatchObject({ status: 404 });
});
it('hides inactive authors and disallows inactive or incomplete writers', async () => {
  const post = await posts.createPost('a', input());
  await db.user.update({ where: { id: 'a' }, data: { accountStatus: 'SUSPENDED' } });
  await expect(posts.getPost('b', post.id)).rejects.toMatchObject({ status: 404 });
  await expect(posts.createPost('a', input())).rejects.toMatchObject({ status: 403 });
  await db.user.update({ where: { id: 'b' }, data: { onboarded: false } });
  await expect(posts.createPost('b', input())).rejects.toMatchObject({ status: 403 });
});
it('paginates posts deterministically and keeps long content out of cards', async () => {
  await db.post.createMany({ data: Array.from({ length: 13 }, (_, i) => ({ id: `post-${String(i).padStart(2, '0')}`, authorId: 'a', clientId: randomUUID(), content: 'Long writing '.repeat(100), createdAt: new Date('2026-01-01') })) });
  const first = await posts.listPosts('b', 'a');
  expect(first.items).toHaveLength(postLimits.page);
  expect(first.items[0].id).toBe('post-12');
  expect(first.items[0].content).toHaveLength(postLimits.preview);
  expect(first.items[0].truncated).toBe(true);
  await db.post.delete({ where: { id: first.items.at(-1)!.id } });
  const second = await posts.listPosts('b', 'a', first.nextCursor);
  expect(second.items).toHaveLength(3);
  expect(second.nextCursor).toBeNull();
  expect(new Set([...first.items, ...second.items].map((p) => p.id)).size).toBe(13);
  expect((await posts.getPost('b', first.items[0].id)).content.length).toBeGreaterThan(postLimits.preview);
  await expect(posts.listPosts('b', 'a', 'bad')).rejects.toBeDefined();
});
it('deduplicates repeated create requests and likes', async () => {
  const data = input();
  const first = await posts.createPost('a', data);
  expect((await posts.createPost('a', data)).id).toBe(first.id);
  expect(await db.post.count()).toBe(1);
  expect(await posts.likePost('b', first.id, { enabled: true })).toEqual({ liked: true, likeCount: 1 });
  expect(await posts.likePost('b', first.id, { enabled: true })).toEqual({ liked: true, likeCount: 1 });
  expect(await posts.likePost('b', first.id, { enabled: false })).toEqual({ liked: false, likeCount: 0 });
  expect(await posts.likePost('b', first.id, { enabled: false })).toEqual({ liked: false, likeCount: 0 });
});
it('creates, paginates and deletes own comments and hides blocked commenters/counts', async () => {
  const post = await posts.createPost('a', input());
  const data = { content: 'Useful update', clientId: randomUUID() };
  const first = await posts.createComment('b', post.id, data);
  expect((await posts.createComment('b', post.id, data)).id).toBe(first.id);
  await db.postComment.createMany({ data: Array.from({ length: 22 }, () => ({ postId: post.id, authorId: 'c', clientId: randomUUID(), content: 'Comment' })) });
  const page = await posts.listComments('a', post.id);
  expect(page.items).toHaveLength(postLimits.commentsPage);
  expect((await posts.listComments('a', post.id, page.nextCursor)).items).toHaveLength(3);
  await posts.likePost('c', post.id, { enabled: true });
  await db.block.create({ data: { blockerId: 'a', blockedId: 'c' } });
  expect((await posts.getPost('a', post.id)).commentCount).toBe(1);
  expect((await posts.getPost('a', post.id)).likeCount).toBe(0);
  expect((await posts.listComments('a', post.id)).items).toHaveLength(1);
  await posts.deleteComment('b', post.id, first.id);
  expect((await posts.listComments('a', post.id)).items).toHaveLength(0);
});
it.each(['', '   ', 'x'.repeat(postLimits.content + 1), '\0bad'])('rejects invalid post content %#', async (content) => {
  await expect(posts.createPost('a', input(content))).rejects.toBeDefined();
});
it('rejects invalid comments, visibility and spoofed fields', async () => {
  const post = await posts.createPost('a', input());
  await expect(posts.createComment('b', post.id, { content: 'x'.repeat(postLimits.comment + 1), clientId: randomUUID() })).rejects.toBeDefined();
  await expect(posts.createPost('a', { ...input(), visibility: 'SECRET' })).rejects.toBeDefined();
  await expect(posts.createComment('b', post.id, { content: 'Hi', clientId: randomUUID(), authorId: 'a' })).rejects.toBeDefined();
});
it('stores text literally instead of treating user content as HTML', async () => {
  const content = '<script>alert(1)</script><img src=x onerror=alert(1)>';
  const post = await posts.createPost('a', input(content));
  expect((await posts.getPost('b', post.id)).content).toBe(content);
  expect(await readFile('src/frontend/features/posts/post-card.tsx', 'utf8')).not.toContain('dangerouslySetInnerHTML');
});
it('enforces persistent post and comment limits, preserving idempotent retries', async () => {
  const data = input(); const post = await posts.createPost('a', data);
  await db.rateLimit.updateMany({ where: { key: { startsWith: 'post:a:' } }, data: { count: postLimits.postsPerHour } });
  expect((await posts.createPost('a', data)).id).toBe(post.id);
  await expect(posts.createPost('a', input())).rejects.toMatchObject({ status: 429 });
  await posts.createComment('b', post.id, { content: 'First', clientId: randomUUID() });
  await db.rateLimit.updateMany({ where: { key: { startsWith: 'comment:b:' } }, data: { count: postLimits.commentsPerHour } });
  await expect(posts.createComment('b', post.id, { content: 'Again', clientId: randomUUID() })).rejects.toMatchObject({ status: 429 });
});
it('reports into the existing moderation queue and retains evidence after deletion', async () => {
  const post = await posts.createPost('a', input('Reported content'));
  const report = await posts.reportPost('b', post.id, { reason: 'Scam' });
  expect((await posts.reportPost('b', post.id, { reason: 'Scam' })).id).toBe(report.id);
  await posts.deletePost('a', post.id);
  const stored = await db.report.findUniqueOrThrow({ where: { id: report.id } });
  expect(stored.postContent).toBe('Reported content');
  expect(stored.postId).toBeNull();
  expect((await db.user.findUniqueOrThrow({ where: { id: 'a' } })).accountStatus).toBe('ACTIVE');
});
it('enriches public posts locally and improves current intent without modifying profiles', async () => {
  const user = await db.user.findUniqueOrThrow({ where: { id: 'a' } });
  const score = async () => (await recommendations.rankedProfiles(user)).students.find((u) => u.id === 'b')!.matchScore;
  const baseline = await score();
  const post = await posts.createPost('a', input('Building a YouTube project. Looking for a video editor.'));
  expect(fetch).not.toHaveBeenCalled();
  await worker.processRecommendationJobs(5, new DisabledProvider());
  const doc = await db.recommendationDocument.findUniqueOrThrow({ where: { kind_targetId: { kind: 'POST', targetId: post.id } } });
  expect(doc.inferred).toMatchObject({ lookingFor: ['Video Editor'] });
  const recentScore = await score();
  expect(recentScore).toBeGreaterThan(baseline);
  expect(recentScore - baseline).toBeLessThanOrEqual(ranking.posts.maxWeight);
  await db.post.update({ where: { id: post.id }, data: { createdAt: new Date(Date.now() - ranking.posts.halfLifeDays * 86400000) } });
  expect(await score()).toBeLessThan(recentScore);
  await db.post.update({ where: { id: post.id }, data: { createdAt: new Date(Date.now() - (ranking.posts.maxAgeDays + 1) * 86400000) } });
  expect(await score()).toBe(baseline);
  expect(await db.user.findUniqueOrThrow({ where: { id: 'a' } })).toEqual(user);
});
it('processes scrubbed public content with validated embeddings and invalidates edits/privacy/deletes', async () => {
  const post = await posts.createPost('a', input('Need a designer. me@example.com https://example.com'));
  const classifyContent = vi.fn(async () => localInference('Need a designer'));
  const provider = { model: 'test-model', classifyContent, extractStructuredProfile: async () => localInference(''), generateEmbedding: vi.fn(async () => Array.from({ length: ranking.embeddingDimensions }, (_, i) => i === 0 ? 1 : 0)) };
  await worker.processRecommendationJobs(5, provider);
  expect(classifyContent.mock.calls[0]).not.toEqual([]);
  expect(JSON.stringify(classifyContent.mock.calls)).not.toContain('me@example.com');
  expect(await db.recommendationDocument.count({ where: { kind: 'POST' } })).toBe(1);
  await posts.editPost('a', post.id, { content: 'New direction', visibility: 'PUBLIC' });
  expect(await db.recommendationDocument.count({ where: { kind: 'POST' } })).toBe(0);
  await posts.editPost('a', post.id, { content: 'Private direction', visibility: 'CONNECTIONS_ONLY' });
  expect(await db.recommendationJob.count({ where: { kind: 'POST' } })).toBe(0);
  await posts.likePost('a', post.id, { enabled: true });
  await posts.createComment('a', post.id, { content: 'Own comment', clientId: randomUUID() });
  await posts.deletePost('a', post.id);
  expect(await db.postComment.count()).toBe(0);
  expect(await db.postLike.count()).toBe(0);
});
it.each(['classification', 'embedding', 'invalid-vector'])('survives %s failure with temporary local intent and bounded retries', async (failure) => {
  const post = await posts.createPost('a', input('Looking for a video editor'));
  const provider = { model: 'test', classifyContent: async () => { if (failure === 'classification') throw Error('private provider error'); return localInference('Looking for a video editor'); }, extractStructuredProfile: async () => localInference(''), generateEmbedding: async () => { if (failure === 'embedding') throw Error('provider unavailable'); return [1, 2]; } };
  const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
  await worker.processRecommendationJobs(1, provider);
  expect((await posts.getPost('b', post.id)).content).toBe('Looking for a video editor');
  const doc = await db.recommendationDocument.findUniqueOrThrow({ where: { kind_targetId: { kind: 'POST', targetId: post.id } } });
  expect(doc.embedding).toEqual([]);
  expect(doc.inferred).toMatchObject({ lookingFor: ['Video Editor'] });
  expect((await db.recommendationJob.findFirstOrThrow()).attempts).toBe(1);
  expect(JSON.stringify(log.mock.calls)).not.toContain('private provider error');
});
it('does not publish stale enrichment if a post becomes private during processing', async () => {
  const post = await posts.createPost('a', input());
  await worker.processRecommendationJobs(1, { model: 'test', classifyContent: async () => localInference(''), extractStructuredProfile: async () => localInference(''), generateEmbedding: async () => { await posts.editPost('a', post.id, { content: 'Now private', visibility: 'CONNECTIONS_ONLY' }); return Array.from({ length: ranking.embeddingDimensions }, (_, i) => i === 0 ? 1 : 0); } });
  expect(await db.recommendationDocument.count({ where: { kind: 'POST' } })).toBe(0);
});
it('enables RLS with no browser policies or public grants for post tables', async () => {
  const rows = await pg.query<{ relname: string; relrowsecurity: boolean }>("SELECT relname,relrowsecurity FROM pg_class WHERE relname IN ('Post','PostLike','PostComment')");
  expect(rows.rows).toHaveLength(3);
  expect(rows.rows.every((r) => r.relrowsecurity)).toBe(true);
  await pg.exec('CREATE ROLE post_browser; GRANT USAGE ON SCHEMA public TO post_browser; GRANT SELECT ON "Post", "PostLike", "PostComment" TO post_browser;');
  await posts.createPost('a', input());
  await pg.exec('SET ROLE post_browser');
  try { expect((await pg.query('SELECT * FROM "Post"')).rows).toHaveLength(0); } finally { await pg.exec('RESET ROLE'); }
});
