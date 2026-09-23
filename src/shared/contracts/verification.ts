export const MAX_VERIFICATION_IMAGE_BYTES = 4_000_000;
export const MAX_VERIFICATION_DATA_URL_LENGTH =
  Math.ceil(MAX_VERIFICATION_IMAGE_BYTES / 3) * 4 + 32;
export const VERIFICATION_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
