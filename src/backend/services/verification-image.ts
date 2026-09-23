import sharp from 'sharp';
import { MAX_VERIFICATION_IMAGE_BYTES } from '@/shared/contracts/verification';
import { AppError, requireThat } from '@/backend/utils/errors';

export async function decodeVerificationImage(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  requireThat(match, 400, 'Upload a JPG, PNG, or WebP image.');
  const bytes = Buffer.from(match[2], 'base64');
  requireThat(bytes.toString('base64') === match[2], 400, 'Invalid image encoding.');
  requireThat(
    bytes.length > 0 && bytes.length <= MAX_VERIFICATION_IMAGE_BYTES,
    413,
    'Image must be at most 4 MB.',
  );
  const formats = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  try {
    const image = sharp(bytes, { limitInputPixels: 20_000_000 });
    const metadata = await image.metadata();
    const mime = formats[metadata.format as keyof typeof formats];
    requireThat(
      mime && mime === match[1] && (metadata.pages ?? 1) === 1,
      400,
      'Upload a non-animated JPG, PNG, or WebP image.',
    );
    // Decode and re-encode, stripping metadata and trailing non-image contents.
    const documentBytes = await image.rotate().toBuffer();
    requireThat(
      documentBytes.length <= MAX_VERIFICATION_IMAGE_BYTES,
      413,
      'Image must be at most 4 MB.',
    );
    return { documentBytes, documentMime: mime };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      400,
      'Invalid or unsupported image. Use a JPG, PNG, or WebP up to 20 megapixels.',
    );
  }
}
