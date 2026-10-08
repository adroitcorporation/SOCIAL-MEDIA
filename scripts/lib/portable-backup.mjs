import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** @param {Uint8Array} bytes @param {Uint8Array} key */
export function sealBackup(bytes, key) {
  if (key.length !== 32) throw new Error('A 32-byte recovery key is required.');
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from('founder-circle-backup-v1'));
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([Buffer.from('FCBACK01'), nonce, cipher.getAuthTag(), ciphertext]);
}

/** @param {Uint8Array} bytes @param {Uint8Array} key */
export function openBackup(bytes, key) {
  const value = Buffer.from(bytes);
  if (key.length !== 32 || value.length < 36 || value.subarray(0, 8).toString() !== 'FCBACK01')
    throw new Error('Invalid encrypted backup.');
  const decipher = createDecipheriv('aes-256-gcm', key, value.subarray(8, 20));
  decipher.setAAD(Buffer.from('founder-circle-backup-v1'));
  decipher.setAuthTag(value.subarray(20, 36));
  return Buffer.concat([decipher.update(value.subarray(36)), decipher.final()]);
}
