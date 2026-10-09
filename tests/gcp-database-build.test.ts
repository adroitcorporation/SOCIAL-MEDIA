import { beforeEach, afterEach, expect, it, vi } from 'vitest';

vi.mock('@prisma/client', () => ({ PrismaClient: class {} }));
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('AUTH_PROVIDER', 'identity-platform');
  vi.stubEnv('NEXT_PHASE', '');
  vi.stubEnv('GCP_PROJECT_ID', 'cynk-staging');
  vi.stubEnv('APP_ENV', 'staging');
  vi.stubEnv('FIREBASE_AUTH_PROJECT_ID', 'cynk-staging-e9c53');
  vi.stubEnv('NEXT_PUBLIC_AUTH_PROVIDER', 'identity-platform');
  vi.stubEnv('FILE_STORAGE_MODE', 'gcs');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'cynk-staging-e9c53');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'cynk-staging-e9c53.firebaseapp.com');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', 'synthetic');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_ID', 'synthetic');
  vi.stubEnv('CLOUD_SQL_CONNECTION_NAME', '');
  vi.stubEnv('DATABASE_URL', '');
  vi.stubEnv('SUPABASE_EXPECTED_PROJECT_REF', '');
});
afterEach(() => vi.unstubAllEnvs());
it('allows Next build module collection without SQL secrets or database queries', async () => {
  vi.stubEnv('NEXT_PHASE', 'phase-production-build');
  await expect(import('../src/backend/database/client')).resolves.toBeDefined();
});
it('still rejects missing or mixed SQL configuration at runtime', async () => {
  await expect(import('../src/backend/database/client')).rejects.toThrow(
    'Cloud SQL project/region/environment mismatch',
  );
});
