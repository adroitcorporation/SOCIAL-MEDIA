import { db } from '@/backend/database/client';
import { requireThat } from '@/backend/utils/errors';
export function validateMutationRequest(request: Request) {
  const origin = request.headers.get('origin');
  const expected =
    process.env.APP_URL ||
    (process.env.NODE_ENV !== 'production' ? new URL(request.url).origin : undefined);
  requireThat(expected, 503, 'APP_URL must be configured.');
  requireThat(!origin || origin === expected, 403, 'Invalid request origin.');
  requireThat(
    (request.headers.get('content-type') || '').includes('application/json'),
    415,
    'Send JSON.',
  );
}
export async function enforceMutationRateLimit(userId: string) {
  const bucket = `${userId}:${Math.floor(Date.now() / 60000)}`;
  const rate = await db.rateLimit.upsert({
    where: { key: bucket },
    create: { key: bucket, expiresAt: new Date(Date.now() + 120000) },
    update: { count: { increment: 1 } },
  });
  requireThat(rate.count <= 90, 429, 'Please wait a moment before trying again.');
  await db.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
