import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  execute: vi.fn(),
  close: vi.fn(),
  connect: vi.fn(),
}));
vi.mock('@prisma/client', () => ({
  PrismaClient: class {
    constructor(config: unknown) {
      mocks.connect(config);
    }
    $queryRawUnsafe = mocks.read;
    $executeRawUnsafe = mocks.execute;
    $disconnect = mocks.close;
  },
}));
import { initializeFreshStagingDatabase } from '../scripts/gcp-fresh-database.mjs';
function environment() {
  return {
    NODE_ENV: 'production' as const,
    GCP_PROJECT_ID: 'cynk-staging',
    APP_ENV: 'staging',
    FIREBASE_AUTH_PROJECT_ID: 'cynk-staging-e9c53',
    AUTH_PROVIDER: 'identity-platform',
    NEXT_PUBLIC_AUTH_PROVIDER: 'identity-platform',
    FILE_STORAGE_MODE: 'gcs',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'cynk-staging-e9c53',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'cynk-staging-e9c53.firebaseapp.com',
    NEXT_PUBLIC_FIREBASE_API_KEY: 'synthetic',
    NEXT_PUBLIC_FIREBASE_APP_ID: 'synthetic',
    CLOUD_SQL_CONNECTION_NAME: 'cynk-staging:asia-south2:cynk-staging-db',
    DIRECT_URL:
      'postgresql://cynk_migrator:synthetic@localhost/cynk_staging?host=/cloudsql/cynk-staging:asia-south2:cynk-staging-db',
    APP_URL: 'https://synthetic.run.app',
    NEXT_PUBLIC_APP_URL: 'https://synthetic.run.app',
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.read.mockResolvedValue([]);
  mocks.execute.mockResolvedValue(1);
});
describe('Fresh staging database initialization', () => {
  it('creates only the approved missing database owned by the migration role', async () => {
    await initializeFreshStagingDatabase(environment());
    expect(mocks.execute).toHaveBeenCalledExactlyOnceWith(
      'CREATE DATABASE "cynk_staging" OWNER "cynk_migrator"',
    );
    expect(new URL(mocks.connect.mock.calls[0][0].datasourceUrl).pathname).toBe('/postgres');
    expect(mocks.close).toHaveBeenCalledOnce();
  });
  it('does not reset or recreate an existing database', async () => {
    mocks.read.mockResolvedValue([{ owner: 'cynk_migrator' }]);
    await initializeFreshStagingDatabase(environment());
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it('stops rather than changing ownership of an unexpected database', async () => {
    mocks.read.mockResolvedValue([{ owner: 'unexpected_owner' }]);
    await expect(initializeFreshStagingDatabase(environment())).rejects.toThrow('owner differs');
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.close).toHaveBeenCalledOnce();
  });
  it('rejects other projects before connecting', async () => {
    const env = environment();
    env.GCP_PROJECT_ID = 'cynk-other';
    await expect(initializeFreshStagingDatabase(env)).rejects.toThrow();
    expect(mocks.connect).not.toHaveBeenCalled();
  });
});
