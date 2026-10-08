import { createClient } from '@supabase/supabase-js';
import { matchesProjectUrl } from '@/shared/config/supabase-project.mjs';
let client: ReturnType<typeof createClient> | undefined;
export function authClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const expected = process.env.NEXT_PUBLIC_SUPABASE_EXPECTED_PROJECT_REF;
  if (expected && !matchesProjectUrl(url, expected))
    throw new Error('Authentication project mismatch.');
  if (!url || !key)
    throw new Error(
      'Authentication is not configured. Add the Supabase variables from .env.example.',
    );
  return (client ??= createClient(url, key));
}
