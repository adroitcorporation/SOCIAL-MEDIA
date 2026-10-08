import { createHash } from 'node:crypto';

export type Bucket = {
  id: string;
  public: boolean;
  file_size_limit: number | null;
  allowed_mime_types: string[] | null;
};
export type ObjectRecord = {
  bucket_id: string;
  name: string;
  metadata: Record<string, unknown>;
  user_metadata?: Record<string, unknown> | null;
  version?: string;
  updated_at?: string;
};
export type Inventory = { buckets: Bucket[]; objects: ObjectRecord[] };
export const objectKey = (o: ObjectRecord) => JSON.stringify([o.bucket_id, o.name]);
export const fingerprint = (o: ObjectRecord) =>
  createHash('sha256').update(JSON.stringify(o)).digest('hex');
export const sizeOf = (o: ObjectRecord) => Number(o.metadata.size ?? o.metadata.contentLength);
export function indexObjects(objects: ObjectRecord[]) {
  const map = new Map<string, ObjectRecord>();
  for (const o of objects) {
    if (!o.name || o.name.split('/').some((p) => !p || p === '.' || p === '..'))
      throw new Error('Unsafe or noncanonical object path');
    if (map.has(objectKey(o))) throw new Error('Duplicate object identity');
    map.set(objectKey(o), o);
  }
  return map;
}
export function compare(source: Inventory, destination: Inventory) {
  const src = indexObjects(source.objects);
  const dst = indexObjects(destination.objects);
  const missing: ObjectRecord[] = [],
    conflicts: ObjectRecord[] = [],
    existing: ObjectRecord[] = [];
  for (const [key, o] of src) {
    const other = dst.get(key);
    if (!other) missing.push(o);
    else if (
      sizeOf(o) !== sizeOf(other) ||
      o.metadata.mimetype !== other.metadata.mimetype ||
      (o.metadata.eTag && other.metadata.eTag && o.metadata.eTag !== other.metadata.eTag)
    )
      conflicts.push(o);
    else existing.push(o); // Metadata compatibility is not proof of byte equality.
  }
  const bucketConflicts = source.buckets.filter((b) => {
    const other = destination.buckets.find((d) => d.id === b.id);
    return (
      !other ||
      b.public !== other.public ||
      b.file_size_limit !== other.file_size_limit ||
      JSON.stringify([...(b.allowed_mime_types ?? [])].sort()) !==
        JSON.stringify([...(other.allowed_mime_types ?? [])].sort())
    );
  });
  return {
    missing,
    conflicts,
    existing,
    extra: [...dst].filter(([k]) => !src.has(k)).map(([, o]) => o),
    bucketConflicts,
  };
}
export class ApiFailure extends Error {
  constructor(public status: number) {
    super(`Storage API failed (${status})`);
  }
}
export function retryAfterMilliseconds(value: string | null, now = Date.now()) {
  if (!value) return 0;
  const seconds = Number(value);
  const milliseconds = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : 0;
}
export async function retry<T>(
  fn: () => Promise<T>,
  sleep: (ms: number) => Promise<void>,
  attempts = 4,
) {
  for (let n = 0; ; n++) {
    try {
      return await fn();
    } catch (e) {
      const transient =
        e instanceof ApiFailure
          ? e.status === 429 || e.status >= 500
          : e instanceof TypeError || (e instanceof DOMException && e.name === 'TimeoutError');
      if (!transient || n + 1 >= attempts) throw e;
      await sleep(Math.min(1000 * 2 ** n, 8000));
    }
  }
}
type ListEntry = {
  name: string;
  id: string | null;
  metadata: Record<string, unknown> | null;
  updated_at?: string | null;
};
export async function listObjects(
  bucket: string,
  list: (prefix: string, offset: number, limit: number) => Promise<ListEntry[]>,
  limit = 100,
) {
  const out: ObjectRecord[] = [],
    prefixes = [''],
    seen = new Set<string>();
  while (prefixes.length) {
    const prefix = prefixes.pop()!;
    if (seen.has(prefix)) throw new Error('Repeated directory');
    seen.add(prefix);
    const pages = new Set<string>();
    for (let offset = 0; ; offset += limit) {
      const page = await list(prefix, offset, limit);
      const pageKey = JSON.stringify(page);
      if (page.length && pages.has(pageKey)) throw new Error('Repeated pagination page');
      pages.add(pageKey);
      for (const entry of page) {
        if (!entry.name || entry.name.includes('/') || entry.name === '.' || entry.name === '..')
          throw new Error('Invalid list entry');
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id === null && entry.metadata === null) prefixes.push(path);
        else
          out.push({
            bucket_id: bucket,
            name: path,
            metadata: entry.metadata ?? {},
            updated_at: entry.updated_at ?? undefined,
          });
      }
      if (page.length < limit) break;
      // A broken server repeating full pages is detected before another request.
      indexObjects(out);
    }
  }
  indexObjects(out);
  return out;
}
export type Receipt = { fingerprint: string; sha256: string; bytes: number };
export type SyncPorts = {
  inventory(side: 'source' | 'destination'): Promise<Inventory>;
  download(side: 'source' | 'destination', object: ObjectRecord): Promise<Receipt>;
  upload(object: ObjectRecord): Promise<void>;
  save(receipts: Record<string, Receipt>): Promise<void>;
};
export async function synchronize(
  ports: SyncPorts,
  receipts: Record<string, Receipt> = {},
  execute = false,
) {
  const source = structuredClone(await ports.inventory('source')),
    destination = structuredClone(await ports.inventory('destination'));
  const plan = compare(source, destination);
  if (!execute) return { plan, transferred: 0, verified: 0, sourceChanged: false };
  if (plan.bucketConflicts.length || plan.conflicts.length)
    throw new Error('Reconciliation requires separate approval; no writes performed');
  const initial = indexObjects(source.objects);
  const dest = indexObjects(destination.objects);
  let transferred = 0,
    verified = 0;
  for (const object of source.objects) {
    const key = objectKey(object);
    const before = indexObjects((await ports.inventory('source')).objects).get(key);
    if (!before || fingerprint(before) !== fingerprint(object))
      throw new Error('Source changed; stop synchronization');
    const src = await ports.download('source', object);
    if (src.bytes !== sizeOf(object)) throw new Error('Source byte count mismatch');
    if (!dest.has(key)) {
      // Always recheck after an interrupted upload; receipts alone never skip verification.
      const current = indexObjects((await ports.inventory('destination')).objects);
      if (!current.has(key)) {
        await ports.upload(object);
        transferred++;
      }
    }
    const target = await ports.download('destination', object);
    if (src.sha256 !== target.sha256 || src.bytes !== target.bytes)
      throw new Error('Destination integrity conflict; never overwrite');
    const after = indexObjects((await ports.inventory('source')).objects).get(key);
    if (!after || fingerprint(after) !== fingerprint(object))
      throw new Error('Source changed during transfer');
    receipts[key] = { ...src, fingerprint: fingerprint(object) };
    await ports.save(receipts);
    verified++;
  }
  const final = indexObjects((await ports.inventory('source')).objects);
  const sourceChanged =
    final.size !== initial.size ||
    [...initial].some(([k, o]) => !final.has(k) || fingerprint(final.get(k)!) !== fingerprint(o));
  if (sourceChanged)
    throw new Error('Source inventory changed; final delta and writer freeze required');
  return { plan, transferred, verified, sourceChanged };
}
