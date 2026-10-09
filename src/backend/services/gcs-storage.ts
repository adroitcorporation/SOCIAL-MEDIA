import 'server-only';
import { Storage } from '@google-cloud/storage';
import { requireThat } from '@/backend/utils/errors';
type Bucket = 'profile-photos' | 'college-ids' | 'event-attachments';
const limits = {
  'profile-photos': 4_000_000,
  'college-ids': 4_000_000,
  'event-attachments': 8_000_000,
};
const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
function checkedPath(path: string) {
  requireThat(
    /^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(path) && !path.includes('..'),
    500,
    'Invalid stored file reference.',
  );
  return path;
}
function bucketName(bucket: Bucket) {
  const project = process.env.GCP_PROJECT_ID;
  const environment = process.env.APP_ENV;
  requireThat(
    project && ['staging', 'production'].includes(environment || ''),
    503,
    'File storage is not configured.',
  );
  return project + '-' + environment + '-' + bucket;
}
export function gcsFileStorage(bucket: Bucket) {
  const name = bucketName(bucket);
  const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
  const object = (path: string) => storage.bucket(name).file(checkedPath(path));
  return {
    async upload(
      path: string,
      bytes: Uint8Array,
      options: { contentType: string; upsert: boolean; cacheControl: string },
    ) {
      requireThat(
        !options.upsert && bytes.length > 0 && bytes.length <= limits[bucket],
        413,
        'Invalid file size or overwrite request.',
      );
      requireThat(
        [...imageTypes, ...(bucket === 'event-attachments' ? ['application/pdf'] : [])].includes(
          options.contentType,
        ),
        415,
        'Unsupported file type.',
      );
      try {
        await object(path).save(Buffer.from(bytes), {
          resumable: false,
          validation: 'crc32c',
          preconditionOpts: { ifGenerationMatch: 0 },
          metadata: {
            contentType: options.contentType,
            cacheControl:
              bucket === 'profile-photos'
                ? 'public, max-age=31536000, immutable'
                : 'private, no-store',
          },
        });
        return { error: null };
      } catch {
        return { error: new Error('File upload failed.') };
      }
    },
    async download(path: string) {
      const file = object(path);
      try {
        const [metadata] = await file.getMetadata();
        requireThat(
          Number(metadata.size) > 0 && Number(metadata.size) <= limits[bucket],
          502,
          'Stored file exceeds limits.',
        );
        const [bytes] = await file.download({ validation: 'crc32c' });
        requireThat(bytes.length === Number(metadata.size), 502, 'Stored file size mismatch.');
        return { data: new Blob([new Uint8Array(bytes)]), error: null };
      } catch {
        return { data: null, error: new Error('File download failed.') };
      }
    },
    async remove(paths: string[]) {
      const files = paths.map(object);
      try {
        await Promise.all(files.map((file) => file.delete({ ignoreNotFound: true })));
        return { error: null };
      } catch {
        return { error: new Error('File deletion failed.') };
      }
    },
    getPublicUrl(path: string) {
      requireThat(bucket === 'profile-photos', 500, 'Private files have no public URL.');
      const origin = new URL(process.env.APP_URL || '');
      requireThat(
        origin.protocol === 'https:' ||
          (process.env.NODE_ENV !== 'production' && origin.protocol === 'http:'),
        503,
        'Public file origin is invalid.',
      );
      return { data: { publicUrl: origin.origin + '/api/public/photos/' + checkedPath(path) } };
    },
  };
}
export async function publicProfilePhoto(path: string) {
  const name = bucketName('profile-photos');
  const file = new Storage({ projectId: process.env.GCP_PROJECT_ID })
    .bucket(name)
    .file(checkedPath(path));
  try {
    const [metadata] = await file.getMetadata();
    requireThat(
      imageTypes.includes(metadata.contentType || '') &&
        Number(metadata.size) > 0 &&
        Number(metadata.size) <= limits['profile-photos'],
      404,
      'Photo unavailable.',
    );
    const { data, error } = await gcsFileStorage('profile-photos').download(path);
    requireThat(!error && data, 404, 'Photo unavailable.');
    return new Response(data, {
      headers: {
        'Content-Type': metadata.contentType!,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return Response.json({ error: 'Photo unavailable.' }, { status: 404 });
  }
}
