import { describe, expect, it, vi } from 'vitest';
import {
  ApiFailure,
  compare,
  fingerprint,
  indexObjects,
  listObjects,
  objectKey,
  retry,
  retryAfterMilliseconds,
  validateApprovedManifest,
  synchronize,
  type Bucket,
  type Inventory,
  type ObjectRecord,
  type Receipt,
  type SyncPorts,
} from '../scripts/lib/storage-sync';

const bucket: Bucket = {
  id: 'private-files',
  public: false,
  file_size_limit: 1024 * 1024 * 1024,
  allowed_mime_types: null,
};
const object = (name = 'user/nested/a.pdf'): ObjectRecord => ({
  bucket_id: bucket.id,
  name,
  metadata: { size: 8, mimetype: 'application/pdf' },
  version: 'one',
  user_metadata: { tag: 'retained', custom_key: { nested_value: 'preserved' } },
});
const inventory = (objects: ObjectRecord[] = []): Inventory => ({ buckets: [bucket], objects });
function fixture() {
  const source = inventory([object()]),
    destination = inventory();
  const receipts: Record<string, Receipt> = {};
  const checksum = { fingerprint: fingerprint(object()), sha256: 'abc', bytes: 8 };
  const ports: SyncPorts = {
    inventory: vi.fn(async (side) => (side === 'source' ? source : destination)),
    download: vi.fn(async () => checksum),
    upload: vi.fn(async (o) => {
      destination.objects.push(structuredClone(o));
    }),
    save: vi.fn(async (current) => Object.assign(receipts, current)),
  };
  return { ports, source, destination, receipts, checksum };
}
describe('Storage migration safety', () => {
  it('locks execution to the authorized snapshot and permits only verified-path resume candidates', () => {
    const b: Bucket = {
      id: 'profile-photos',
      public: true,
      file_size_limit: 4000000,
      allowed_mime_types: ['image/png'],
    };
    const source: Inventory = {
      buckets: [b],
      objects: Array.from({ length: 11 }, (_, i) => ({
        ...object(`user/${i}.png`),
        bucket_id: b.id,
        metadata: { size: i === 10 ? 3078406 : 2000000, mimetype: 'image/png' },
      })),
    };
    const destination: Inventory = { buckets: [b], objects: [] };
    const approved = structuredClone({ source, destination });
    expect(() => validateApprovedManifest(source, destination, approved)).not.toThrow();
    expect(() =>
      validateApprovedManifest(source, { ...destination, objects: [source.objects[0]] }, approved),
    ).not.toThrow();
    const replaced = structuredClone(source);
    replaced.objects[0].name = 'user/unapproved.png';
    expect(() => validateApprovedManifest(replaced, destination, approved)).toThrow(
      'Source differs',
    );
    const changed = structuredClone(source);
    changed.objects[0].version = 'replacement';
    expect(() => validateApprovedManifest(changed, destination, approved)).toThrow(
      'Source differs',
    );
    expect(() =>
      validateApprovedManifest(
        source,
        { buckets: [{ ...b, public: false }], objects: [] },
        approved,
      ),
    ).toThrow('Bucket configuration');
    expect(() =>
      validateApprovedManifest(source, { ...destination, objects: [object()] }, approved),
    ).toThrow('Unexpected destination');
    expect(() =>
      validateApprovedManifest(source, destination, { ...approved, source: inventory() }),
    ).toThrow('authorized 11-image');
  });
  it('honors seconds and HTTP-date Retry-After hints without accepting invalid delays', () => {
    expect(retryAfterMilliseconds('3')).toBe(3000);
    expect(
      retryAfterMilliseconds('Thu, 08 Oct 2026 12:00:03 GMT', Date.parse('2026-10-08T12:00:00Z')),
    ).toBe(3000);
    expect(retryAfterMilliseconds('-1')).toBe(0);
    expect(retryAfterMilliseconds('invalid')).toBe(0);
  });
  it('dry-run inventories missing objects without downloading or writing', async () => {
    const f = fixture();
    const r = await synchronize(f.ports);
    expect(r.plan.missing).toHaveLength(1);
    expect(f.ports.upload).not.toHaveBeenCalled();
    expect(f.ports.download).not.toHaveBeenCalled();
  });
  it('never deletes destination-only files', async () => {
    const f = fixture();
    f.destination.objects.push(object('another/extra.pdf'));
    const r = await synchronize(f.ports, {}, true);
    expect(r.plan.extra).toHaveLength(1);
    expect(f.destination.objects).toHaveLength(2);
  });
  it('rejects duplicate identities and unsafe paths', () => {
    expect(() => indexObjects([object(), object()])).toThrow('Duplicate');
    expect(() => indexObjects([object('../a')])).toThrow('Unsafe');
  });
  it('paginates nested directories and exact-full pages', async () => {
    const list = vi.fn(async (prefix: string, offset: number) =>
      prefix === ''
        ? offset === 0
          ? [{ name: 'user', id: null, metadata: null }]
          : []
        : prefix === 'user'
          ? offset === 0
            ? [{ name: 'nested', id: null, metadata: null }]
            : []
          : offset === 0
            ? [{ name: 'a.pdf', id: 'file', metadata: { size: 8 } }]
            : [],
    );
    const files = await listObjects(bucket.id, list, 1);
    expect(files[0].name).toBe('user/nested/a.pdf');
    expect(list).toHaveBeenCalledWith('user/nested', 1, 1);
  });
  it('fails on a broken repeated page rather than looping', async () => {
    await expect(
      listObjects(bucket.id, async () => [{ name: 'folder', id: null, metadata: null }], 1),
    ).rejects.toThrow('Repeated pagination');
  });
  it('retries network interruption and throttling with exponential backoff', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network'))
      .mockRejectedValueOnce(new ApiFailure(429))
      .mockResolvedValue('ok');
    const sleep = vi.fn(async () => {});
    expect(await retry(fn, sleep)).toBe('ok');
    expect(sleep.mock.calls).toEqual([[1000], [2000]]);
  });
  it('bounds transient retries and never retries authorization failures', async () => {
    const fn = vi.fn(async () => {
      throw new ApiFailure(503);
    });
    await expect(retry(fn, async () => {})).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(4);
    const denied = vi.fn(async () => {
      throw new ApiFailure(403);
    });
    await expect(retry(denied, async () => {})).rejects.toThrow();
    expect(denied).toHaveBeenCalledTimes(1);
  });
  it('preserves private bucket and object metadata', async () => {
    const f = fixture();
    await synchronize(f.ports, {}, true);
    expect(f.destination.buckets[0].public).toBe(false);
    expect(f.destination.objects[0]).toEqual(f.source.objects[0]);
  });
  it('blocks bucket privacy/config mismatches before writes', async () => {
    const f = fixture();
    f.destination.buckets = [{ ...bucket, public: true }];
    await expect(synchronize(f.ports, {}, true)).rejects.toThrow('Reconciliation');
    expect(f.ports.upload).not.toHaveBeenCalled();
  });
  it('blocks destination metadata conflicts without overwriting', async () => {
    const f = fixture();
    f.destination.objects = [{ ...object(), metadata: { size: 9 } }];
    await expect(synchronize(f.ports, {}, true)).rejects.toThrow('Reconciliation');
    expect(f.ports.upload).not.toHaveBeenCalled();
  });
  it('verifies byte hashes for existing objects instead of trusting metadata', async () => {
    const f = fixture();
    f.destination.objects = [object()];
    f.ports.download = vi.fn(async (side) => ({
      ...f.checksum,
      sha256: side === 'source' ? 'abc' : 'corrupt',
    }));
    await expect(synchronize(f.ports, {}, true)).rejects.toThrow('integrity');
    expect(f.ports.upload).not.toHaveBeenCalled();
  });
  it('resumes after a successful upload whose response was lost', async () => {
    const f = fixture();
    f.ports.upload = vi.fn(async (o) => {
      f.destination.objects.push(o);
      throw new TypeError('lost response');
    });
    await expect(synchronize(f.ports, {}, true)).rejects.toThrow();
    const r = await synchronize(f.ports, {}, true);
    expect(r.transferred).toBe(0);
    expect(r.verified).toBe(1);
    expect(f.ports.upload).toHaveBeenCalledTimes(1);
  });
  it('does not mark failed uploads verified', async () => {
    const f = fixture();
    f.ports.upload = vi.fn(async () => {
      throw new ApiFailure(500);
    });
    await expect(synchronize(f.ports, {}, true)).rejects.toThrow();
    expect(f.ports.save).not.toHaveBeenCalled();
  });
  it('is idempotent and rechecks receipt-backed files', async () => {
    const f = fixture();
    await synchronize(f.ports, f.receipts, true);
    await synchronize(f.ports, f.receipts, true);
    expect(f.ports.upload).toHaveBeenCalledTimes(1);
    expect(f.ports.download).toHaveBeenCalledTimes(4);
    expect(f.receipts[objectKey(object())].sha256).toBe('abc');
  });
  it('handles large-object metadata without buffering bytes in the coordinator', async () => {
    const f = fixture();
    f.source.objects[0].metadata.size = 500_000_000;
    f.checksum.bytes = 500_000_000;
    await synchronize(f.ports, {}, true);
    expect(f.ports.upload).toHaveBeenCalledTimes(1);
  });
  it('detects source size corruption before any upload', async () => {
    const f = fixture();
    f.checksum.bytes = 7;
    await expect(synchronize(f.ports, {}, true)).rejects.toThrow('byte count');
    expect(f.ports.upload).not.toHaveBeenCalled();
  });
  it('detects a new source upload at final inventory', async () => {
    const f = fixture();
    f.ports.save = vi.fn(async () => {
      f.source.objects.push(object('user/new.pdf'));
    });
    await expect(synchronize(f.ports, {}, true)).rejects.toThrow('inventory changed');
  });
  it('detects source replacement during transfer', async () => {
    const f = fixture();
    f.ports.download = vi.fn(async (side) => {
      if (side === 'destination') f.source.objects[0].version = 'two';
      return f.checksum;
    });
    await expect(synchronize(f.ports, {}, true)).rejects.toThrow('Source changed');
  });
  it('does not mistake same size/mime for content equality in dry-run', () => {
    expect(compare(inventory([object()]), inventory([object()])).existing).toHaveLength(1);
  });
});
