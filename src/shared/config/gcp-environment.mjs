// Deployment guards only. Errors never include environment values.
export const GCP_PRIMARY_REGION = 'asia-south2';

export function validateGcpEnvironment(env, { migration = false } = {}) {
  const project = env.GCP_PROJECT_ID;
  const stage = env.APP_ENV;
  const authProject = env.FIREBASE_AUTH_PROJECT_ID;
  if (env.BACKEND_URL || env.VERCEL_ENV)
    throw new Error('External frontend/backend rewrites are forbidden in full-stack Cloud Run.');
  if (
    !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project || '') ||
    !['staging', 'production'].includes(stage)
  )
    throw new Error('Invalid GCP project/environment.');
  if (
    env.AUTH_PROVIDER !== 'identity-platform' ||
    env.NEXT_PUBLIC_AUTH_PROVIDER !== 'identity-platform' ||
    env.FILE_STORAGE_MODE !== 'gcs'
  )
    throw new Error('GCP providers must be explicitly selected.');
  if (
    !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(authProject || '') ||
    env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== authProject ||
    env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN !== authProject + '.firebaseapp.com' ||
    !env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    !env.NEXT_PUBLIC_FIREBASE_APP_ID
  )
    throw new Error('Google public authentication configuration mismatch.');
  if (
    env.LOCAL_DEMO === 'true' ||
    env.FIREBASE_AUTH_EMULATOR_HOST ||
    env.NEXT_PUBLIC_SUPABASE_URL ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_STORAGE_URL ||
    env.SUPABASE_EXPECTED_PROJECT_REF
  )
    throw new Error('Legacy/emulator credentials are forbidden in GCP deployment.');
  const instance = project + ':' + GCP_PRIMARY_REGION + ':cynk-' + stage + '-db';
  if (env.CLOUD_SQL_CONNECTION_NAME !== instance)
    throw new Error('Cloud SQL project/region/environment mismatch.');
  let url;
  try {
    url = new URL(migration ? env.DIRECT_URL : env.DATABASE_URL);
  } catch {
    throw new Error('Cloud SQL connection is missing.');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.hostname !== 'localhost' ||
    url.pathname !== '/cynk_' + stage ||
    decodeURIComponent(url.username) !== (migration ? 'cynk_migrator' : 'cynk_runtime') ||
    url.searchParams.get('host') !== '/cloudsql/' + instance ||
    !url.password ||
    (url.searchParams.has('sslmode') &&
      !['disable', 'require'].includes(url.searchParams.get('sslmode')))
  )
    throw new Error('Cloud SQL Unix-socket connection mismatch.');
  if (
    !migration &&
    (!/^[1-5]$/.test(url.searchParams.get('connection_limit') || '') ||
      !/^[1-9][0-9]?$/.test(url.searchParams.get('pool_timeout') || ''))
  )
    throw new Error('Explicit bounded Prisma pool is required.');
  let origin;
  try {
    origin = new URL(env.APP_URL);
  } catch {
    throw new Error('Application origin is missing.');
  }
  if (
    origin.protocol !== 'https:' ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash ||
    env.NEXT_PUBLIC_APP_URL !== origin.origin
  )
    throw new Error('Canonical HTTPS frontend origin is required.');
  return { project, stage, instance };
}
