export function authProvider(value: string | undefined) {
  if (!value || value === 'supabase') return 'supabase' as const;
  if (value === 'identity-platform') return 'identity-platform' as const;
  throw new Error('Unsupported authentication provider.');
}
