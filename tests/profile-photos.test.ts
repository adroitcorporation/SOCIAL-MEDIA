import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { AppError } from '@/backend/utils/errors';
const storage = vi.hoisted(() => ({ upload: vi.fn(), remove: vi.fn(), getPublicUrl: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ storage: { from: () => storage } })),
}));
vi.mock('@/backend/services/permissions', () => ({ requireActiveActor: vi.fn() }));
import { requireActiveActor } from '@/backend/services/permissions';
import { uploadProfilePhoto } from '@/backend/services/profile-photos';

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://synthetic.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-server-only-key');
  vi.mocked(requireActiveActor).mockResolvedValue({ id: 'owner' } as never);
  storage.upload.mockResolvedValue({ error: null });
  storage.remove.mockResolvedValue({ error: null });
  storage.getPublicUrl.mockImplementation((path: string) => ({
    data: {
      publicUrl: `https://synthetic.supabase.co/storage/v1/object/public/profile-photos/${path}`,
    },
  }));
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
const png = () =>
  sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } })
    .png()
    .toBuffer();
describe('server-validated profile photos', () => {
  it('uses actor-owned UUID paths and strips trailing payloads before public storage', async () => {
    const bytes = Buffer.concat([await png(), Buffer.from('private-metadata-marker')]);
    const result = await uploadProfilePhoto('owner', bytes, 'image/png');
    const [path, uploaded, options] = storage.upload.mock.calls[0];
    expect(path).toMatch(/^owner\/[a-f0-9-]{36}\.png$/);
    expect(uploaded.includes(Buffer.from('private-metadata-marker'))).toBe(false);
    expect((await sharp(uploaded).metadata()).format).toBe('png');
    expect(options).toMatchObject({ contentType: 'image/png', upsert: false });
    expect(Object.keys(result)).toEqual(['url']);
  });
  it.each(['image/jpeg', 'image/svg+xml', 'text/html'])(
    'rejects a forged or unsupported MIME %s',
    async (mime) => {
      await expect(uploadProfilePhoto('owner', await png(), mime)).rejects.toMatchObject({
        status: 400,
      });
      expect(storage.upload).not.toHaveBeenCalled();
    },
  );
  it('rejects a fake image and an oversized image before storage', async () => {
    await expect(
      uploadProfilePhoto('owner', Buffer.from('<script>x</script>'), 'image/png'),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      uploadProfilePhoto('owner', Buffer.alloc(4_000_001), 'image/png'),
    ).rejects.toMatchObject({ status: 413 });
    expect(storage.upload).not.toHaveBeenCalled();
  });
  it('denies an inactive application account regardless of its provider session', async () => {
    vi.mocked(requireActiveActor).mockRejectedValue(new AppError(403, 'Inactive account'));
    await expect(uploadProfilePhoto('owner', await png(), 'image/png')).rejects.toMatchObject({
      status: 403,
    });
    expect(storage.upload).not.toHaveBeenCalled();
  });
  it('removes an uploaded object if the account was revoked during the provider write', async () => {
    vi.mocked(requireActiveActor)
      .mockResolvedValueOnce({ id: 'owner' } as never)
      .mockResolvedValueOnce({ id: 'owner' } as never)
      .mockRejectedValueOnce(new AppError(403, 'Inactive account'));
    await expect(uploadProfilePhoto('owner', await png(), 'image/png')).rejects.toMatchObject({
      status: 403,
    });
    expect(storage.remove).toHaveBeenCalledWith([storage.upload.mock.calls[0][0]]);
  });
  it('fails closed when the backend key is absent', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    await expect(uploadProfilePhoto('owner', await png(), 'image/png')).rejects.toMatchObject({
      status: 503,
    });
    expect(storage.upload).not.toHaveBeenCalled();
  });
  it('returns a generic failure without exposing provider error details', async () => {
    storage.upload.mockResolvedValue({ error: { message: 'private-provider-marker' } });
    await expect(uploadProfilePhoto('owner', await png(), 'image/png')).rejects.toMatchObject({
      status: 502,
      message: 'Unable to upload this photo. Please try again.',
    });
  });
});
