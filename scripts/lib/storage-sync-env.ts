import { parseEnv } from 'node:util';

const projects = { source: 'rznbuzkgzsryadokvcfh', destination: 'lxofcmzgzbgqvlmwizgm' };
export function parseStorageCredentials(text: string) {
  const env = parseEnv(text);
  const result = {} as Record<keyof typeof projects, { url: string; key: string }>;
  for (const side of ['source', 'destination'] as const) {
    const prefix = side === 'source' ? 'SOURCE' : 'DEST';
    const url = env[`${prefix}_SUPABASE_URL`];
    const key = env[`${prefix}_SUPABASE_SERVICE_ROLE_KEY`];
    if (!url || !key) throw new Error(`${side} credential variables are missing`);
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error(`${side} project URL is invalid`);
    }
    if (
      parsedUrl.origin !== `https://${projects[side]}.supabase.co` ||
      parsedUrl.username ||
      parsedUrl.password ||
      parsedUrl.search ||
      parsedUrl.hash ||
      !['/', '/rest/v1', '/rest/v1/'].includes(parsedUrl.pathname)
    )
      throw new Error(`${side} project URL does not match the approved project`);
    if (!key.startsWith('sb_secret_') && !key.startsWith('eyJ'))
      throw new Error(`${side} requires a backend-only key`);
    if (key.startsWith('eyJ')) {
      let payload: { ref?: string; role?: string };
      try {
        payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
      } catch {
        throw new Error(`${side} legacy key is malformed`);
      }
      if (payload.role !== 'service_role' || payload.ref !== projects[side])
        throw new Error(`${side} legacy key role or project mismatch`);
    }
    result[side] = { url: parsedUrl.origin, key };
  }
  return result;
}
