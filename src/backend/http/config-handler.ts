import 'server-only';
import { authProvider } from '@/shared/config/auth-provider';

// Match the public values embedded in this deployment's browser auth client.
// Startup must not depend on authentication, the database, or a remote backend.
export function handleConfigRequest() {
  return Response.json(
    {
      demo: process.env.NODE_ENV !== 'production' && process.env.LOCAL_DEMO === 'true',
      configured: Boolean(
        authProvider(process.env.NEXT_PUBLIC_AUTH_PROVIDER) === 'identity-platform'
          ? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
              process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
              process.env.NEXT_PUBLIC_FIREBASE_APP_ID &&
              process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ===
                process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID + '.firebaseapp.com'
          : process.env.NEXT_PUBLIC_SUPABASE_URL &&
              process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      ),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
