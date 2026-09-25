import { requireActiveActor } from '@/backend/services/permissions';
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { db } from '@/backend/database/client';
import { requireThat } from '@/backend/utils/errors';
import { isAllowedCollegeEmail } from '@/shared/config/college-access';
export const isLocalDemo = () =>
  process.env.NODE_ENV !== 'production' && process.env.LOCAL_DEMO === 'true';
export const isEmailConfirmed = (confirmedAt: string | null | undefined) => Boolean(confirmedAt);
export async function authenticate(request: Request) {
  if (isLocalDemo()) {
    const user = await db.user.findUnique({ where: { id: 'demo-aarav' } });
    requireThat(user, 503, 'Run npm run db:seed first.');
    return requireActiveActor(user.id);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  requireThat(url && key, 503, 'Authentication is not configured.');
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
  requireThat(token && token.length < 8192, 401, 'Please sign in to continue.');
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  requireThat(!error && data.user, 401, 'Your session has expired. Please sign in again.');
  requireThat(
    data.user.email && isAllowedCollegeEmail(data.user.email),
    403,
    'Use your @lnmiit.ac.in college email to access this app.',
  );
  const emailVerified = isEmailConfirmed(data.user.email_confirmed_at);
  requireThat(emailVerified, 403, 'Confirm your email using the link we sent before continuing.');
  const user = await db.user.upsert({
    where: { id: data.user.id },
    update: { emailVerified },
    create: { id: data.user.id, name: 'New student', emailVerified },
  });
  return requireActiveActor(user.id);
}
