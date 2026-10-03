import 'server-only';

// Match the public values embedded in this deployment's browser auth client.
// Startup must not depend on authentication, the database, or a remote backend.
export function handleConfigRequest() {
  return Response.json(
    {
      demo: process.env.NODE_ENV !== 'production' && process.env.LOCAL_DEMO === 'true',
      configured: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      ),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
