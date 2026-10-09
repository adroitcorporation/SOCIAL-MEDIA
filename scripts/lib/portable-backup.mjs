import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

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

/** Verify decrypted object payloads offline; this does not restore the Storage service.
 * @param {{bucket_id: string, name: string, bytes: string, sha256: string, metadata: {size: number}}[]} files
 */
export function verifyBackupFiles(files) {
  const seen = new Set();
  let totalBytes = 0;
  for (const file of files) {
    const identity = JSON.stringify([file.bucket_id, file.name]);
    const bytes = Buffer.from(file.bytes, 'base64');
    if (
      seen.has(identity) ||
      !file.bucket_id ||
      !file.name ||
      !/^[a-f0-9]{64}$/.test(file.sha256) ||
      bytes.toString('base64') !== file.bytes ||
      bytes.length !== Number(file.metadata.size) ||
      createHash('sha256').update(bytes).digest('hex') !== file.sha256
    )
      throw new Error('Recovered Storage payload integrity mismatch');
    seen.add(identity);
    totalBytes += bytes.length;
  }
  return { objects: seen.size, bytes: totalBytes };
}
