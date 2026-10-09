import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateGcpEnvironment } from '../src/shared/config/gcp-environment.mjs';
import { authProvider } from '../src/shared/config/auth-provider';
import { verifyGoogleIdentity } from '../src/backend/auth/identity-platform';
import { gcsFileStorage, publicProfilePhoto } from '../src/backend/services/gcs-storage';
const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  user: vi.fn(),
  save: vi.fn(),
  metadata: vi.fn(),
  download: vi.fn(),
  remove: vi.fn(),
  bucket: vi.fn(),
}));
vi.mock('firebase-admin/app', () => ({
  getApps: () => [],
  applicationDefault: () => ({}),
  initializeApp: () => ({}),
}));
vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifyIdToken: mocks.verify, getUser: mocks.user }),
}));
vi.mock('@google-cloud/storage', () => ({
  Storage: class {
    bucket(name: string) {
      mocks.bucket(name);
      return {
        file: () => ({
          save: mocks.save,
          getMetadata: mocks.metadata,
          download: mocks.download,
          delete: mocks.remove,
        }),
      };
    }
  },
}));
function environment() {
  const project = 'cynk-unit-test';
  const instance = project + ':asia-south1:cynk-staging-db';
  return {
    GCP_PROJECT_ID: project,
    APP_ENV: 'staging',
    AUTH_PROVIDER: 'identity-platform',
    NEXT_PUBLIC_AUTH_PROVIDER: 'identity-platform',
    FILE_STORAGE_MODE: 'gcs',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: project,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: project + '.firebaseapp.com',
    NEXT_PUBLIC_FIREBASE_API_KEY: 'synthetic-public-key',
    NEXT_PUBLIC_FIREBASE_APP_ID: 'synthetic-app',
    CLOUD_SQL_CONNECTION_NAME: instance,
    DATABASE_URL:
      'postgresql://cynk_runtime:synthetic@localhost/cynk_staging?host=/cloudsql/' +
      instance +
      '&connection_limit=2&pool_timeout=10',
    APP_URL: 'https://staging.example.test',
    NEXT_PUBLIC_APP_URL: 'https://staging.example.test',
  };
}
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.resetAllMocks();
  for (const [key, value] of Object.entries(environment())) vi.stubEnv(key, value);
  mocks.verify.mockResolvedValue({
    uid: 'test-user',
    email: 'test@lnmiit.ac.in',
    email_verified: true,
    role: 'ULTIMATE',
  });
  mocks.user.mockResolvedValue({
    uid: 'test-user',
    email: 'test@lnmiit.ac.in',
    emailVerified: true,
    disabled: false,
  });
  mocks.metadata.mockResolvedValue([{ size: '3', contentType: 'image/jpeg' }]);
  mocks.download.mockResolvedValue([Buffer.from([1, 2, 3])]);
});
describe('Explicit GCP environment isolation', () => {
  it('keeps the existing provider as default and rejects unknown choices', () => {
    expect(authProvider(undefined)).toBe('supabase');
    expect(authProvider('identity-platform')).toBe('identity-platform');
    expect(() => authProvider('unknown')).toThrow();
  });
  it('accepts only the dedicated staging socket and bounded pool', () => {
    expect(validateGcpEnvironment(environment()).stage).toBe('staging');
  });
  it.each([
    ['DATABASE_URL', 'postgresql://cynk_runtime:synthetic@db.example.test/cynk_staging'],
    ['DATABASE_URL', environment().DATABASE_URL.replace('cynk_runtime', 'cynk_migrator')],
    [
      'DATABASE_URL',
      environment().DATABASE_URL.replace('connection_limit=2', 'connection_limit=20'),
    ],
    ['APP_ENV', 'production'],
    ['AUTH_PROVIDER', 'supabase'],
    ['NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'another-project'],
    ['NEXT_PUBLIC_SUPABASE_URL', 'https://old.example.test'],
    ['SUPABASE_SERVICE_ROLE_KEY', 'synthetic'],
    ['LOCAL_DEMO', 'true'],
    ['FIREBASE_AUTH_EMULATOR_HOST', 'localhost:9099'],
    ['APP_URL', 'https://user:password@staging.example.test'],
  ])('rejects unsafe %s configuration', (key, value) => {
    expect(() => validateGcpEnvironment({ ...environment(), [key]: value })).toThrow();
  });
  it('uses a distinct migration identity', () => {
    const env = {
      ...environment(),
      DIRECT_URL: environment().DATABASE_URL.replace('cynk_runtime', 'cynk_migrator'),
    };
    expect(validateGcpEnvironment(env, { migration: true }).stage).toBe('staging');
    expect(() =>
      validateGcpEnvironment({ ...env, DIRECT_URL: env.DATABASE_URL }, { migration: true }),
    ).toThrow();
  });
});
describe('Google server-side authentication adapter', () => {
  it('requires revocation checking and returns no token role claims', async () => {
    expect(await verifyGoogleIdentity('synthetic-token')).toEqual({
      id: 'test-user',
      email: 'test@lnmiit.ac.in',
      confirmed: true,
    });
    expect(mocks.verify).toHaveBeenCalledWith('synthetic-token', true);
  });
  it.each(['disabled', 'email-change', 'untrusted-uid', 'revoked'])(
    'rejects %s accounts',
    async (kind) => {
      if (kind === 'disabled')
        mocks.user.mockResolvedValue({
          uid: 'test-user',
          email: 'test@lnmiit.ac.in',
          disabled: true,
        });
      if (kind === 'email-change')
        mocks.user.mockResolvedValue({ uid: 'test-user', email: 'different@lnmiit.ac.in' });
      if (kind === 'untrusted-uid')
        mocks.user.mockResolvedValue({ uid: '../another', email: 'test@lnmiit.ac.in' });
      if (kind === 'revoked')
        mocks.verify.mockRejectedValue(new Error('sensitive-provider-detail'));
      await expect(verifyGoogleIdentity('synthetic-token')).rejects.toMatchObject({ status: 401 });
    },
  );
  it('does not mark an unconfirmed token as verified', async () => {
    mocks.verify.mockResolvedValue({
      uid: 'test-user',
      email: 'test@lnmiit.ac.in',
      email_verified: false,
    });
    expect((await verifyGoogleIdentity('synthetic-token')).confirmed).toBe(false);
  });
  it('refuses mixed projects before contacting Google', async () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'another-project');
    await expect(verifyGoogleIdentity('synthetic-token')).rejects.toMatchObject({ status: 503 });
    expect(mocks.verify).not.toHaveBeenCalled();
  });
});
describe('Private GCS adapter', () => {
  const options = { contentType: 'image/jpeg', upsert: false, cacheControl: '' };
  it('uses staging bucket, integrity validation and a no-overwrite precondition', async () => {
    expect(
      (
        await gcsFileStorage('profile-photos').upload(
          'test-user/photo.jpg',
          new Uint8Array([1, 2, 3]),
          options,
        )
      ).error,
    ).toBeNull();
    expect(mocks.bucket).toHaveBeenCalledWith('cynk-unit-test-staging-profile-photos');
    expect(mocks.save.mock.calls[0][1]).toMatchObject({
      validation: 'crc32c',
      preconditionOpts: { ifGenerationMatch: 0 },
    });
  });
  it('never produces a public URL for college IDs or attachments', () => {
    for (const bucket of ['college-ids', 'event-attachments'] as const)
      expect(() => gcsFileStorage(bucket).getPublicUrl('test-user/document.pdf')).toThrow();
  });
  it('rejects overwrites, executable MIME types and oversize uploads', async () => {
    const storage = gcsFileStorage('profile-photos');
    await expect(
      storage.upload('test-user/photo.jpg', new Uint8Array([1]), { ...options, upsert: true }),
    ).rejects.toMatchObject({ status: 413 });
    await expect(
      storage.upload('test-user/photo.jpg', new Uint8Array([1]), {
        ...options,
        contentType: 'text/html',
      }),
    ).rejects.toMatchObject({ status: 415 });
    await expect(
      storage.upload('test-user/photo.jpg', new Uint8Array(4_000_001), options),
    ).rejects.toMatchObject({ status: 413 });
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('sanitizes provider failures and stops on conflicts', async () => {
    mocks.save.mockRejectedValue(new Error('credential-sensitive conflict'));
    expect(
      (
        await gcsFileStorage('profile-photos').upload(
          'test-user/photo.jpg',
          new Uint8Array([1]),
          options,
        )
      ).error?.message,
    ).toBe('File upload failed.');
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });
  it('bounds reads before downloading and verifies byte length', async () => {
    mocks.metadata.mockResolvedValue([{ size: '4000001' }]);
    expect((await gcsFileStorage('college-ids').download('test-user/id.jpg')).error).not.toBeNull();
    expect(mocks.download).not.toHaveBeenCalled();
    mocks.metadata.mockResolvedValue([{ size: '4' }]);
    expect((await gcsFileStorage('college-ids').download('test-user/id.jpg')).error).not.toBeNull();
  });
  it('downloads, deletes and proxies only bounded profile photos', async () => {
    const storage = gcsFileStorage('profile-photos');
    expect(
      Array.from(
        new Uint8Array(await (await storage.download('test-user/photo.jpg')).data!.arrayBuffer()),
      ),
    ).toEqual([1, 2, 3]);
    expect((await storage.remove(['test-user/photo.jpg'])).error).toBeNull();
    expect(mocks.remove).toHaveBeenCalledWith({ ignoreNotFound: true });
    expect(storage.getPublicUrl('test-user/photo.jpg').data.publicUrl).toBe(
      'https://staging.example.test/api/public/photos/test-user/photo.jpg',
    );
    expect(
      (await publicProfilePhoto('test-user/photo.jpg')).headers.get('X-Content-Type-Options'),
    ).toBe('nosniff');
    mocks.metadata.mockResolvedValue([{ size: '3', contentType: 'text/html' }]);
    expect((await publicProfilePhoto('test-user/photo.jpg')).status).toBe(404);
  });
  it('rejects traversal paths', async () => {
    expect(() => gcsFileStorage('profile-photos').getPublicUrl('../photo.jpg')).toThrow();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
