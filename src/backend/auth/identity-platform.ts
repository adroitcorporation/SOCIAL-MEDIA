import 'server-only';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { requireThat } from '@/backend/utils/errors';

export async function verifyGoogleIdentity(token: string) {
  const projectId = process.env.GCP_PROJECT_ID;
  requireThat(
    projectId && projectId === process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    503,
    'Authentication project is not configured consistently.',
  );
  requireThat(
    process.env.NODE_ENV !== 'production' || !process.env.FIREBASE_AUTH_EMULATOR_HOST,
    503,
    'Authentication emulator is forbidden in production.',
  );
  const name = 'cynk-' + projectId;
  const app =
    getApps().find((app) => app.name === name) ||
    initializeApp({ projectId, credential: applicationDefault() }, name);
  const auth = getAuth(app);
  try {
    const decoded = await auth.verifyIdToken(token, true);
    const account = await auth.getUser(decoded.uid);
    requireThat(
      !account.disabled &&
        decoded.uid === account.uid &&
        /^[A-Za-z0-9_-]{1,128}$/.test(account.uid),
      401,
      'Your session has expired. Please sign in again.',
    );
    requireThat(
      decoded.email === account.email,
      401,
      'Your account changed. Please sign in again.',
    );
    return {
      id: account.uid,
      email: account.email,
      confirmed: Boolean(account.emailVerified && decoded.email_verified),
    };
  } catch {
    requireThat(false, 401, 'Your session has expired. Please sign in again.');
    throw new Error('Unreachable');
  }
}
