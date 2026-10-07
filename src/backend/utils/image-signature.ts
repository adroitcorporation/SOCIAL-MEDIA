import { requireThat } from './errors';

/** Reject unsupported formats before invoking any native image loader. */
export function requireImageSignature(bytes: Uint8Array, mime: string) {
  const header = Buffer.from(bytes.subarray(0, 12));
  requireThat(
    (mime === 'image/jpeg' && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) ||
      (mime === 'image/png' &&
        header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (mime === 'image/webp' &&
        header.toString('ascii', 0, 4) === 'RIFF' &&
        header.toString('ascii', 8, 12) === 'WEBP'),
    400,
    'Image content must match a JPG, PNG, or WebP file.',
  );
}
