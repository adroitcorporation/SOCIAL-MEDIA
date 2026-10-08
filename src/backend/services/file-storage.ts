import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { requireThat } from '@/backend/utils/errors';

export type FileBucket = 'profile-photos' | 'college-ids' | 'event-attachments';
export const privateFilesUseStorage = () => process.env.FILE_STORAGE_MODE === 'supabase';

export function fileStorage(bucket: FileBucket) {
  const url = process.env.SUPABASE_STORAGE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  requireThat(url && key, 503, 'File storage is not configured. Contact support.');
  requireThat(
    url === process.env.NEXT_PUBLIC_SUPABASE_URL,
    503,
    'File storage must use the authentication project.',
  );
  const expected = process.env.SUPABASE_EXPECTED_PROJECT_REF;
  if (expected) {
    requireThat(
      new URL(url).hostname === `${expected}.supabase.co`,
      503,
      'File storage project mismatch.',
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from(bucket);
}

function checkedPath(path: string) {
  requireThat(
    /^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(path) && !path.includes('..'),
    500,
    'Invalid stored file reference.',
  );
  return path;
}

export async function storePrivateFile(
  bucket: Exclude<FileBucket, 'profile-photos'>,
  path: string,
  bytes: Uint8Array,
  mime: string,
) {
  const { error } = await fileStorage(bucket).upload(checkedPath(path), bytes, {
    contentType: mime,
    upsert: false,
    cacheControl: '0',
  });
  requireThat(!error, 502, 'Unable to upload this file. Please try again.');
}

export async function readPrivateFile(bucket: Exclude<FileBucket, 'profile-photos'>, path: string) {
  const { data, error } = await fileStorage(bucket).download(checkedPath(path));
  requireThat(!error && data, 502, 'Unable to download this file. Please try again.');
  return new Uint8Array(await data.arrayBuffer());
}

export async function removePrivateFile(
  bucket: Exclude<FileBucket, 'profile-photos'>,
  path: string,
) {
  const { error } = await fileStorage(bucket).remove([checkedPath(path)]);
  requireThat(!error, 502, 'Unable to delete this file. Please try again.');
}
