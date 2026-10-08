import { expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { openBackup, sealBackup } from '../scripts/lib/portable-backup.mjs';

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
