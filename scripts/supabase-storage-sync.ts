// Manual operator utility. Defaults to read-only; no runtime app imports or database writes.
import { loadEnvFile } from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  ApiFailure,
  fingerprint,
  listObjects,
  objectKey,
  synchronize,
  retryAfterMilliseconds,
  type Inventory,
  type ObjectRecord,
  type Receipt,
} from './lib/storage-sync';

try {
  loadEnvFile();
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
}
const args = process.argv.slice(2);
const execute = args.includes('--execute');
if (execute && args.includes('--dry-run'))
  throw new Error('Dry-run and execute are mutually exclusive');
const value = (name: string) => args[args.indexOf(name) + 1];
const root = resolve('.local/storage-sync');
await mkdir(root, { recursive: true, mode: 0o700 });
// Operator must validate restrictive ACLs, including on Windows; mode is insufficient there.
await readFile(`${root}/owner-only-confirmed.txt`);
if (
  args.some(
    (a) =>
      ![
        '--dry-run',
        '--execute',
        '--approved-destination=lxofcmzgzbgqvlmwizgm',
        '--inventory',
        value('--inventory'),
      ].includes(a),
  )
)
  throw new Error('Unknown argument');
if (execute && !args.includes('--approved-destination=lxofcmzgzbgqvlmwizgm'))
  throw new Error('Explicit destination approval argument required');
if (execute && args.includes('--inventory'))
  throw new Error('Execution requires fresh API inventories');
const refs = { source: 'rznbuzkgzsryadokvcfh', destination: 'lxofcmzgzbgqvlmwizgm' };
const keys = {
  source: process.env.STORAGE_SYNC_SOURCE_KEY,
  destination: process.env.MIGRATION_DESTINATION_STORAGE_KEY,
};
const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
let deferredUntil = 0;
const storageFetch: typeof fetch = async (input, options) => {
  const wait = Math.max(0, deferredUntil - Date.now());
  if (wait > 60000) throw new Error('Provider rate limit requires a longer pause; resume later');
  if (wait) await pause(wait);
  const response = await fetch(input, {
    ...options,
    redirect: 'error',
    signal: options?.signal ?? AbortSignal.timeout(120000),
  });
  if (response.status === 429 || response.status === 503)
    deferredUntil = Date.now() + retryAfterMilliseconds(response.headers.get('retry-after'));
  return response;
};
const api = async <T>(fn: () => Promise<T>): Promise<T> => {
  const { retry } = await import('./lib/storage-sync');
  return retry(async () => {
    await pause(150);
    return fn();
  }, pause);
};
function storageFailure(error: { statusCode?: string; originalError?: unknown }) {
  if (error.originalError instanceof TypeError)
    return new TypeError('Storage network interruption');
  if (error.originalError instanceof DOMException && error.originalError.name === 'TimeoutError')
    return new DOMException('Storage request timed out', 'TimeoutError');
  return new ApiFailure(Number(error.statusCode));
}
const clients = () => {
  if (!keys.source || !keys.destination)
    throw new Error('Backend-only source and destination Storage credentials required');
  return Object.fromEntries(
    Object.entries(refs).map(([side, ref]) => [
      side,
      createClient(`https://${ref}.supabase.co`, keys[side as keyof typeof keys]!, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: storageFetch },
      }),
    ]),
  ) as Record<keyof typeof refs, ReturnType<typeof createClient>>;
};
const snapshotFile = args.includes('--inventory') ? value('--inventory') : undefined;
const snapshots = snapshotFile
  ? (JSON.parse(await readFile(snapshotFile, 'utf8')) as Record<keyof typeof refs, Inventory>)
  : undefined;
const admin = snapshots ? undefined : clients();
const inventory = async (side: keyof typeof refs): Promise<Inventory> => {
  if (snapshots) return snapshots[side];
  const client = admin![side];
  const buckets = await api(async () => {
    const r = await client.storage.listBuckets();
    if (r.error) throw storageFailure(r.error);
    return r.data;
  });
  const objects: ObjectRecord[] = [];
  for (const bucket of buckets)
    objects.push(
      ...(await listObjects(bucket.id, async (prefix, offset, limit) =>
        api(async () => {
          const r = await client.storage
            .from(bucket.id)
            .list(prefix, { offset, limit, sortBy: { column: 'name', order: 'asc' } });
          if (r.error) throw storageFailure(r.error);
          return r.data;
        }),
      )),
    );
  for (const object of objects) {
    const info = await api(async () => {
      // SDK info() recursively camel-cases custom metadata keys. Read the supported
      // REST info endpoint directly so operator-provided metadata stays byte-for-byte JSON.
      const path = [object.bucket_id, ...object.name.split('/')].map(encodeURIComponent).join('/');
      const response = await storageFetch(
        `https://${refs[side]}.supabase.co/storage/v1/object/info/${path}`,
        {
          headers: {
            apikey: keys[side]!,
            ...(keys[side]!.startsWith('eyJ') ? { Authorization: `Bearer ${keys[side]}` } : {}),
          },
        },
      );
      if (!response.ok) {
        await response.body?.cancel();
        throw new ApiFailure(response.status);
      }
      return (await response.json()) as {
        version: string;
        last_modified?: string;
        size?: number;
        content_type?: string;
        etag?: string;
        cache_control?: string;
        metadata?: Record<string, unknown>;
      };
    });
    object.version = info.version;
    object.updated_at = info.last_modified ?? object.updated_at;
    object.user_metadata = info.metadata ?? {};
    object.metadata = {
      size: info.size ?? object.metadata.size,
      mimetype: info.content_type ?? object.metadata.mimetype,
      eTag: info.etag ?? object.metadata.eTag,
      cacheControl: info.cache_control ?? object.metadata.cacheControl,
    };
  }
  return {
    buckets: buckets.map((b) => ({
      id: b.id,
      public: b.public,
      file_size_limit: b.file_size_limit ?? null,
      allowed_mime_types: b.allowed_mime_types ?? null,
    })),
    objects,
  };
};
const sourceFiles = new Map<string, string>();
const maxBytes = 1024 * 1024 * 1024; // Stream one object at a time; limit temporary disk consumption.
const download = async (side: keyof typeof refs, object: ObjectRecord): Promise<Receipt> =>
  api(async () => {
    const file = `${root}/${randomUUID()}.part`;
    const encoded = [object.bucket_id, ...object.name.split('/')].map(encodeURIComponent).join('/');
    let bytes = 0;
    const hash = createHash('sha256');
    try {
      const response = await storageFetch(
        `https://${refs[side]}.supabase.co/storage/v1/object/authenticated/${encoded}`,
        {
          headers: {
            apikey: keys[side]!,
            ...(keys[side]!.startsWith('eyJ') ? { Authorization: `Bearer ${keys[side]}` } : {}),
          },
          redirect: 'error',
          signal: AbortSignal.timeout(120000),
        },
      );
      if (!response.ok) {
        await response.body?.cancel();
        throw new ApiFailure(response.status);
      }
      if (!response.body) throw new Error('Missing object response');
      const limiter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          bytes += chunk.length;
          if (bytes > maxBytes) return callback(new Error('Object exceeds 1 GiB disk bound'));
          hash.update(chunk);
          callback(null, chunk);
        },
      });
      await pipeline(
        Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
        limiter,
        createWriteStream(file, { flags: 'wx', mode: 0o600 }),
      );
      if (side === 'source') {
        const old = sourceFiles.get(objectKey(object));
        if (old) await rm(old, { force: true });
        sourceFiles.set(objectKey(object), file);
      } else await rm(file);
      return { sha256: hash.digest('hex'), bytes, fingerprint: fingerprint(object) };
    } catch (e) {
      await rm(file, { force: true });
      throw e;
    }
  });
const receiptPath = `${root}/receipts.json`;
let receipts: Record<string, Receipt> = {};
try {
  receipts = JSON.parse(await readFile(receiptPath, 'utf8'));
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
}
try {
  const report = await synchronize(
    {
      inventory,
      download,
      upload: async (object) => {
        await api(async () => {
          const stream = createReadStream(sourceFiles.get(objectKey(object))!);
          try {
            const r = await admin!.destination.storage
              .from(object.bucket_id)
              .upload(object.name, stream, {
                upsert: false,
                duplex: 'half',
                contentType: String(object.metadata.mimetype || 'application/octet-stream'),
                cacheControl: String(object.metadata.cacheControl || 'max-age=0').replace(
                  /^max-age=/,
                  '',
                ),
                metadata: object.user_metadata ?? {},
              });
            // An ambiguous success is handled by a fresh inventory on the next run; never upsert.
            if (r.error) throw storageFailure(r.error);
          } finally {
            stream.destroy();
          }
        });
      },
      save: async (current) => {
        await writeFile(`${receiptPath}.tmp`, JSON.stringify(current, null, 2), { mode: 0o600 });
        await rename(`${receiptPath}.tmp`, receiptPath);
        for (const file of sourceFiles.values()) await rm(file, { force: true });
        sourceFiles.clear();
      },
    },
    receipts,
    execute,
  );
  await writeFile(
    `${root}/report-${Date.now()}.json`,
    JSON.stringify(
      {
        observedAt: new Date().toISOString(),
        mode: execute ? 'execute' : 'dry-run',
        source: refs.source,
        destination: refs.destination,
        ...report,
      },
      null,
      2,
    ),
    { flag: 'wx', mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      mode: execute ? 'execute' : 'dry-run',
      missing: report.plan.missing.length,
      conflicts: report.plan.conflicts.length,
      extra: report.plan.extra.length,
      bucketConflicts: report.plan.bucketConflicts.length,
      transferred: report.transferred,
      verified: report.verified,
    }),
  );
} finally {
  for (const file of sourceFiles.values()) await rm(file, { force: true });
}
