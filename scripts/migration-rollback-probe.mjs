// Staging-only transactional recovery probe. This is NOT a full-service rollback.
import { loadEnvFile } from 'node:process';
import { PrismaClient } from '@prisma/client';

let db;
try {
  loadEnvFile();
  const url = new URL(process.env.MIGRATION_DESTINATION_DATABASE_URL || '');
  if (
    url.hostname !== 'aws-0-ap-southeast-1.pooler.supabase.com' ||
    url.port !== '5432' ||
    decodeURIComponent(url.username) !== 'postgres.lxofcmzgzbgqvlmwizgm' ||
    url.pathname !== '/postgres'
  ) {
    throw new Error('Destination guard failed');
  }
  url.searchParams.set('sslmode', 'require');
  const tables = [
    'public."User"',
    'auth.users',
    'public."EventAttachment"',
    'public."CollegeVerificationRequest"',
    'public."RecommendationJob"',
  ];
  db = new PrismaClient({ datasources: { db: { url: url.href } }, log: [] });
  const result = await db.$transaction(
    async (tx) => {
      const content = async () =>
        Promise.all(
          tables.map(async (table) => {
            // Only whole-table digests enter process memory; no rows/password hashes are returned.
            const [value] = await tx.$queryRawUnsafe(`SELECT encode(sha256(convert_to(
        coalesce(string_agg(to_jsonb(t)::text, E'\\n' ORDER BY to_jsonb(t)::text), ''), 'UTF8')), 'hex') AS digest
        FROM ${table} t`);
            return value.digest;
          }),
        );
      const before = await content();
      await tx.$executeRawUnsafe('SAVEPOINT migration_recovery_probe');
      const userChanged =
        await tx.$executeRawUnsafe(`UPDATE public."User" SET name = 'Migration rollback probe'
      WHERE id = (SELECT id FROM public."User" ORDER BY id LIMIT 1)`);
      const authChanged =
        await tx.$executeRawUnsafe(`UPDATE auth.users SET last_sign_in_at = '2000-01-01T00:00:00Z'
      WHERE id = (SELECT id FROM auth.users ORDER BY id LIMIT 1)`);
      const attachmentChanged =
        await tx.$executeRawUnsafe(`UPDATE public."EventAttachment" SET bytes = decode('70726f6265', 'hex')
      WHERE id = (SELECT id FROM public."EventAttachment" ORDER BY id LIMIT 1)`);
      const privateDocumentChanged =
        await tx.$executeRawUnsafe(`UPDATE public."CollegeVerificationRequest"
      SET "documentBytes" = decode('70726f6265', 'hex')
      WHERE id = (SELECT id FROM public."CollegeVerificationRequest" WHERE "documentBytes" IS NOT NULL ORDER BY id LIMIT 1)`);
      const during = await content();
      await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT migration_recovery_probe');
      const after = await content();
      await tx.$executeRawUnsafe('RELEASE SAVEPOINT migration_recovery_probe');
      if (
        [userChanged, authChanged, attachmentChanged, privateDocumentChanged].some(
          (count) => count !== 1,
        ) ||
        before.slice(0, 4).some((digest, index) => digest === during[index]) ||
        before.some((digest, index) => digest !== after[index])
      ) {
        throw new Error('Recovery comparison failed'); // Outer transaction rolls back on failure.
      }
      return {
        tables_checked: tables.length,
        deliberate_mutations: 4,
        restored_content_matches: true,
      };
    },
    { timeout: 30000, isolationLevel: 'Serializable' },
  );
  console.log(
    JSON.stringify(
      {
        measured_at: new Date().toISOString(),
        target: 'Singapore staging only',
        ...result,
        scope:
          'SQL savepoint recovery of application/Auth records and private bytea; no persistent data changes',
        storage_service_recovery: 'not tested',
        auth_login_recovery: 'not tested',
        environment_switch_recovery: 'not tested',
        full_service_rollback: 'not verified',
      },
      null,
      2,
    ),
  );
} catch {
  console.error(
    'Staging recovery probe failed and its transaction was aborted. Details withheld; no recovery claim.',
  );
  process.exitCode = 1;
} finally {
  await db?.$disconnect();
}
