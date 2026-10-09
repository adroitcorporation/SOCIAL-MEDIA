// Only the approved fresh staging database; never use this against old services.
import { PrismaClient } from '@prisma/client';
import { validateGcpEnvironment } from '../src/shared/config/gcp-environment.mjs';
export async function initializeFreshStagingDatabase(env = process.env) {
  validateGcpEnvironment(env, { migration: true });
  if (env.GCP_PROJECT_ID !== 'cynk-staging' || env.APP_ENV !== 'staging')
    throw new Error('Fresh staging initialization only.');
  const url = new URL(env.DIRECT_URL);
  url.pathname = '/postgres';
  url.searchParams.set('connection_limit', '1');
  const admin = new PrismaClient({ datasourceUrl: url.toString() });
  try {
    const rows = await admin.$queryRawUnsafe(
      "SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname = 'cynk_staging'",
    );
    if (rows.length && rows[0].owner !== 'cynk_migrator')
      throw new Error('Existing staging database owner differs; initialization stopped.');
    if (!rows.length)
      await admin.$executeRawUnsafe('CREATE DATABASE "cynk_staging" OWNER "cynk_migrator"');
  } finally {
    await admin.$disconnect();
  }
}
