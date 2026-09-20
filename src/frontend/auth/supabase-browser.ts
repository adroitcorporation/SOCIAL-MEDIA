import { createClient } from '@supabase/supabase-js';
let client: ReturnType<typeof createClient> | undefined;
export function authClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error(
      'Authentication is not configured. Add the Supabase variables from .env.example.',
    );
  return (client ??= createClient(url, key));
}
