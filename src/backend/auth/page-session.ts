import 'server-only';
import { authenticate } from './session';
import type { Principal } from '@/shared/contracts/permissions';
import { requireThat } from '@/backend/utils/errors';

export const pageSessionCookie = 'circle-page-session';
// The frontend can run separately from the database-owning backend.
export async function pageIdentity(token?: string): Promise<Principal> {
  const backend =
    process.env.BACKEND_URL ||
    (process.env.VERCEL_ENV === 'production'
      ? 'https://founder-circle-backend.onrender.com'
      : undefined);
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  if (!backend) return authenticate(new Request('http://localhost/api/session', { headers }));
  const response = await fetch(`${backend.replace(/\/$/, '')}/api/session`, {
    headers,
    cache: 'no-store',
  });
  requireThat(response.ok, response.status, 'Please sign in with an active account.');
  return response.json();
}
