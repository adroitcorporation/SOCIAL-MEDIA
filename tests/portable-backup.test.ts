import { expect, it } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import { openBackup, sealBackup, verifyBackupFiles } from '../scripts/lib/portable-backup.mjs';

it('recovers bytes with a portable key and authenticates all ciphertext', () => {
  const key = randomBytes(32);
  const original = randomBytes(10000);
  const encrypted = sealBackup(original, key);
  expect(openBackup(encrypted, key)).toEqual(original);
  expect(encrypted.includes(original)).toBe(false);
  expect(() => openBackup(encrypted, randomBytes(32))).toThrow();
  for (const offset of [0, 8, 20, 36, encrypted.length - 1]) {
    const changed = Buffer.from(encrypted);
    changed[offset] ^= 1;
    expect(() => openBackup(changed, key)).toThrow();
  }
  expect(() => openBackup(encrypted.subarray(0, 35), key)).toThrow();
  expect(sealBackup(original, key)).not.toEqual(encrypted);
});

it('verifies populated Storage payloads after portable decryption and rejects corrupt manifests', () => {
  const bytes = Buffer.from([0, 1, 2, 255]);
  const file = {
    bucket_id: 'college-ids',
    name: 'fixture/private.png',
    bytes: bytes.toString('base64'),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    metadata: { size: bytes.length },
  };
  const key = randomBytes(32);
  const recovered = JSON.parse(
    openBackup(sealBackup(Buffer.from(JSON.stringify([file])), key), key).toString(),
  );
  expect(verifyBackupFiles(recovered)).toEqual({ objects: 1, bytes: 4 });
  expect(verifyBackupFiles([])).toEqual({ objects: 0, bytes: 0 });
  expect(() => verifyBackupFiles([file, file])).toThrow();
  expect(() =>
    verifyBackupFiles([{ ...file, bytes: Buffer.from('other').toString('base64') }]),
  ).toThrow();
  expect(() => verifyBackupFiles([{ ...file, metadata: { size: 5 } }])).toThrow();
  expect(() => verifyBackupFiles([{ ...file, sha256: 'b'.repeat(64) }])).toThrow();
  expect(() => verifyBackupFiles([{ ...file, bytes: file.bytes + '!' }])).toThrow();
});
