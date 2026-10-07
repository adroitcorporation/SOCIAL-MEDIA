import { db } from '@/backend/database/client';
import { requireThat } from '@/backend/utils/errors';

const rateLimitCleanupIntervalMs = 60_000;
let lastRateLimitCleanup = 0;

export function validateMutationRequest(request: Request, allowBinary = false) {
  const origin = request.headers.get('origin');
  const expected =
    process.env.APP_URL ||
    (process.env.NODE_ENV !== 'production' ? new URL(request.url).origin : undefined);
  requireThat(expected, 503, 'APP_URL must be configured.');
  requireThat(!origin || origin === expected, 403, 'Invalid request origin.');
  requireThat(
    (request.headers.get('content-type') || '').includes('application/json') ||
      (allowBinary && request.headers.get('content-type') === 'application/octet-stream'),
    415,
    'Send JSON.',
  );
}

async function enforceRateLimit(key: string, maximum: number, message: string) {
  const now = Date.now();
  const rate = await db.rateLimit.upsert({
    where: { key },
    create: { key, expiresAt: new Date(now + 120000) },
    update: { count: { increment: 1 } },
  });
  requireThat(rate.count <= maximum, 429, message);
  if (now - lastRateLimitCleanup >= rateLimitCleanupIntervalMs) {
    lastRateLimitCleanup = now;
    await db.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date(now) } } });
  }
}
export const enforceMutationRateLimit = (userId: string) =>
  enforceRateLimit(
    `${userId}:${Math.floor(Date.now() / 60000)}`,
    90,
    'Please wait a moment before trying again.',
  );
export const enforceReadRateLimit = (userId: string) =>
  enforceRateLimit(
    `read:${userId}:${Math.floor(Date.now() / 60000)}`,
    240,
    'Please wait a moment before loading more data.',
  );
export const enforceLiveRateLimit = (userId: string) =>
  enforceRateLimit(
    `live:${userId}:${Math.floor(Date.now() / 60000)}`,
    20,
    'Please wait before opening more live connections.',
  );
export const enforcePhotoUploadRateLimit = (userId: string) =>
  enforceRateLimit(
    `photo:${userId}:${Math.floor(Date.now() / 60000)}`,
    6,
    'Please wait before uploading more photos.',
  );
