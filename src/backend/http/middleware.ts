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

export async function enforceMutationRateLimit(userId: string) {
  const now = Date.now();
  const bucket = `${userId}:${Math.floor(now / 60000)}`;
  const rate = await db.rateLimit.upsert({
    where: { key: bucket },
    create: { key: bucket, expiresAt: new Date(now + 120000) },
    update: { count: { increment: 1 } },
  });
  requireThat(rate.count <= 90, 429, 'Please wait a moment before trying again.');

  // Expiry cleanup is maintenance, not part of every mutation's critical path.
  // Throttle it per server instance; the indexed expiresAt predicate keeps each sweep bounded.
  if (now - lastRateLimitCleanup >= rateLimitCleanupIntervalMs) {
    lastRateLimitCleanup = now;
    await db.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date(now) } } });
  }
}
