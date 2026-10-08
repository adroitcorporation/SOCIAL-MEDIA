import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const storage = vi.hoisted(() => ({ upload: vi.fn(), download: vi.fn(), remove: vi.fn() }));
const client = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: client.create }));
import { readPrivateFile, storePrivateFile, fileStorage } from '@/backend/services/file-storage';
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://singapore.supabase.co');
  vi.stubEnv('SUPABASE_STORAGE_URL', 'https://singapore.supabase.co');
  vi.stubEnv('SUPABASE_EXPECTED_PROJECT_REF', 'singapore');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-private-test-key');
  client.create.mockReturnValue({ storage: { from: () => storage } });
  storage.upload.mockResolvedValue({ error: null });
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
describe('private file boundary', () => {
  it('fails closed on mixed Auth/Storage projects before initializing a client', () => {
    vi.stubEnv('SUPABASE_STORAGE_URL', 'https://seoul.supabase.co');
    expect(() => fileStorage('college-ids')).toThrow();
    expect(client.create).not.toHaveBeenCalled();
  });
  it('rejects traversal and remote references before downloading', async () => {
    await expect(readPrivateFile('college-ids', '../private')).rejects.toMatchObject({
      status: 500,
    });
    await expect(
      readPrivateFile('college-ids', 'https://attacker.example/file'),
    ).rejects.toMatchObject({ status: 500 });
    expect(storage.download).not.toHaveBeenCalled();
  });
  it('uploads non-overwriting private bytes without returning a public URL', async () => {
    await storePrivateFile('college-ids', 'owner/document', new Uint8Array([1, 2]), 'image/png');
    expect(storage.upload).toHaveBeenCalledWith('owner/document', expect.any(Uint8Array), {
      contentType: 'image/png',
      upsert: false,
      cacheControl: '0',
    });
  });
  it('withholds provider failures instead of leaking details', async () => {
    storage.download.mockResolvedValue({ error: { message: 'private-provider-data' }, data: null });
    await expect(readPrivateFile('college-ids', 'owner/document')).rejects.toMatchObject({
      status: 502,
      message: 'Unable to download this file. Please try again.',
    });
  });
});
