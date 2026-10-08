import { afterEach, expect, it, vi } from 'vitest';
const doubles = vi.hoisted(() => ({ query: vi.fn(), getUser: vi.fn() }));
vi.mock('@/backend/database/client', () => ({ db: { $queryRaw: doubles.query } }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getUser: doubles.getUser } }),
}));
import { handleApiRequest } from '@/backend/http/api-handler';
import { handleLiveRequest } from '@/backend/http/live-handler';
import { authenticate } from '@/backend/auth/session';
import { processRecommendationJobs } from '@/backend/recommendations/worker';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it('blocks mutations and side-effecting reads before authentication, parsing or database access', async () => {
  vi.stubEnv('MIGRATION_MAINTENANCE', 'true');
  for (const [path, method] of [
    ['connections', 'POST'],
    ['conversations/a/messages', 'POST'],
    ['profile/photo', 'POST'],
    ['events/a/attachments', 'POST'],
    ['ideas', 'POST'],
    ['state', 'GET'],
    ['session', 'GET'],
    ['health', 'POST'],
    ['health/extra', 'GET'],
  ]) {
    const response = await handleApiRequest(
      new Request(`https://staging.invalid/api/${path}`, { method }),
      path.split('/'),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('60');
    expect((await response.json()).code).toBe('MIGRATION_MAINTENANCE');
  }
  expect(doubles.getUser).not.toHaveBeenCalled();
  expect(doubles.query).not.toHaveBeenCalled();
});

it('keeps only health/config available and stops Auth synchronization, SSE and jobs', async () => {
  vi.stubEnv('MIGRATION_MAINTENANCE', 'true');
  doubles.query.mockResolvedValue([{ value: 1 }]);
  expect(
    (await handleApiRequest(new Request('https://staging.invalid/api/health'), ['health'])).status,
  ).toBe(200);
  expect(
    (await handleApiRequest(new Request('https://staging.invalid/api/config'), ['config'])).status,
  ).toBe(200);
  expect((await handleLiveRequest(new Request('https://staging.invalid/api/live'))).status).toBe(
    503,
  );
  await expect(authenticate(new Request('https://staging.invalid/session'))).rejects.toMatchObject({
    status: 503,
  });
  expect(await processRecommendationJobs()).toBe(0);
  expect(doubles.getUser).not.toHaveBeenCalled();
  expect(doubles.query).toHaveBeenCalledTimes(1);
});

it('resumes the normal authentication boundary when maintenance is removed', async () => {
  vi.stubEnv('MIGRATION_MAINTENANCE', 'true');
  await expect(authenticate(new Request('https://staging.invalid/session'))).rejects.toMatchObject({
    status: 503,
  });
  vi.stubEnv('MIGRATION_MAINTENANCE', 'false');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://staging.invalid');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'public-fixture');
  await expect(authenticate(new Request('https://staging.invalid/session'))).rejects.toMatchObject({
    status: 401,
  });
});
