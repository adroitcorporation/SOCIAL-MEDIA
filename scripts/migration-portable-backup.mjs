// Singapore-only read backup and local in-memory database recovery. Never restores remotely.
import { loadEnvFile } from 'node:process';
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { PGlite } from '@electric-sql/pglite';
import { matchesProjectDatabase } from '../src/shared/config/supabase-project.mjs';
import { sealBackup, openBackup, verifyBackupFiles } from './lib/portable-backup.mjs';
import { restoreCopySection } from './lib/restore-copy.mjs';

try {
  loadEnvFile();
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const restoreOnly = process.argv.includes('--restore-only');
const ref = 'lxofcmzgzbgqvlmwizgm';
const source = process.env.MIGRATION_DESTINATION_DATABASE_URL;
if (!restoreOnly && !matchesProjectDatabase(source, ref))
  throw new Error('Singapore backup guard failed.');
const url = new URL(source || 'postgresql://offline.invalid/postgres');
if (!restoreOnly && url.hostname.endsWith('.pooler.supabase.com') && url.port !== '5432')
  throw new Error('Backup requires the Singapore session pooler on port 5432.');
const root = '.local/migration-backups/20261008-singapore';
// Operator must create this owner-only directory first; do not create an unprotected key store.
await readFile(`${root}/owner-only-confirmed.txt`);
const keyRoot = '.local/migration-recovery-keys';
await readFile(`${keyRoot}/owner-only-confirmed.txt`);
const keyPath = `${keyRoot}/singapore-recovery-key.bin`;
let key;
try {
  key = await readFile(keyPath);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  if (restoreOnly) throw new Error('Recovery key is missing.');
  key = randomBytes(32);
  await writeFile(keyPath, key, { flag: 'wx', mode: 0o600 });
}
const bin = process.env.MIGRATION_POSTGRES_BIN || 'C:/Program Files/PostgreSQL/18/bin';
const suffix = process.platform === 'win32' ? '.exe' : '';
const pgEnv = {
  ...process.env,
  PGHOST: url.hostname,
  PGPORT: url.port || '5432',
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: url.pathname.slice(1),
  PGSSLMODE: 'require',
  PGOPTIONS: '-c default_transaction_read_only=on -c statement_timeout=60000',
};
function command(name, args, env, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(`${bin}/${name}${suffix}`, args, { env, windowsHide: true, stdio: 'pipe' });
    const output = [];
    const errors = [];
    let size = 0;
    child.stdout.on('data', (chunk) => {
      size += chunk.length;
      if (size > 128 * 1024 * 1024) child.kill();
      else output.push(chunk);
    });
    child.stderr.on('data', (chunk) => errors.push(chunk));
    child.on('error', () => reject(new Error(`${name} could not start.`)));
    child.on('close', async (code) => {
      if (code === 0) resolve(Buffer.concat(output));
      else {
        // Provider/restore diagnostics may contain data. Keep them encrypted, never print them.
        await writeFile(`${root}/${name}-failure.enc`, sealBackup(Buffer.concat(errors), key));
        reject(new Error(`${name} failed; encrypted operator diagnostics saved.`));
      }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}
const quote = (value) => '"' + value.replaceAll('"', '""') + '"';
const db = restoreOnly
  ? undefined
  : new PrismaClient({ datasources: { db: { url: source } }, log: [] });
let memory;
let phase = 'backup';
const started = performance.now();
const report = {
  observed_at: new Date().toISOString(),
  project: ref,
  production_operations: 0,
  historical_storage_operations: 0,
  portable_encryption_verified: false,
  database_restore_verified: false,
  supabase_service_recovery_verified: false,
  cross_service_consistency_verified: false,
};
try {
  if (!restoreOnly) {
    const admin = createClient(
      `https://${ref}.supabase.co`,
      process.env.MIGRATION_DESTINATION_STORAGE_KEY || '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const bucketResult = await admin.storage.listBuckets();
    if (bucketResult.error) throw new Error('Singapore Storage credential rejected.');
    const snapshot = await db.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'UTC'");
        const [exported] = await tx.$queryRawUnsafe('SELECT pg_export_snapshot() AS snapshot');
        const tables = await tx.$queryRawUnsafe(
          "SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','auth') ORDER BY schemaname,tablename",
        );
        const manifest = [];
        for (const table of tables) {
          const identifier = `${quote(table.schemaname)}.${quote(table.tablename)}`;
          const [digest] = await tx.$queryRawUnsafe(
            `SELECT count(*)::int AS count, encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text COLLATE "C"),''),'UTF8')),'hex') AS digest FROM ${identifier} t`,
          );
          manifest.push({ ...table, ...digest });
        }
        const constraints = await tx.$queryRawUnsafe(
          "SELECT n.nspname AS schema,c.relname AS table_name,x.conname,x.contype,x.convalidated,pg_get_constraintdef(x.oid) AS definition FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth') ORDER BY 1,2,3",
        );
        const policies = await tx.$queryRawUnsafe(
          "SELECT * FROM pg_policies WHERE schemaname IN ('public','auth','storage') ORDER BY schemaname,tablename,policyname",
        );
        const objects = await tx.$queryRawUnsafe(
          'SELECT bucket_id,name,owner_id,metadata,user_metadata,version FROM storage.objects ORDER BY bucket_id,name',
        );
        const dump = await command(
          'pg_dump',
          [
            '--format=custom',
            '--no-owner',
            '--no-acl',
            '--schema=public',
            '--schema=auth',
            `--snapshot=${exported.snapshot}`,
          ],
          pgEnv,
        );
        return { manifest, constraints, policies, objects, dump };
      },
      { isolationLevel: 'RepeatableRead', timeout: 120000 },
    );
    const files = [];
    for (const object of snapshot.objects) {
      const downloaded = await admin.storage.from(object.bucket_id).download(object.name);
      if (downloaded.error || !downloaded.data) throw new Error('Singapore file backup failed.');
      const bytes = Buffer.from(await downloaded.data.arrayBuffer());
      files.push({
        ...object,
        bytes: bytes.toString('base64'),
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    }
    const after = await db.$queryRawUnsafe(
      'SELECT bucket_id,name,owner_id,metadata,user_metadata,version FROM storage.objects ORDER BY bucket_id,name',
    );
    if (JSON.stringify(after) !== JSON.stringify(snapshot.objects))
      throw new Error('Storage changed during backup; stop for synchronization.');
    const bundle = {
      format: 2,
      project: ref,
      created_at: report.observed_at,
      canonical_timezone: 'UTC',
      canonical_collation: 'C',
      dump: snapshot.dump.toString('base64'),
      manifest: snapshot.manifest,
      constraints: snapshot.constraints,
      policies: snapshot.policies,
      buckets: bucketResult.data,
      files,
    };
    const plaintext = Buffer.from(JSON.stringify(bundle));
    const encrypted = sealBackup(plaintext, key);
    const version = report.observed_at.replaceAll(/[^0-9]/g, '');
    await writeFile(`${root}/singapore-backup-${version}.enc`, encrypted, {
      mode: 0o600,
      flag: 'wx',
    });
    await writeFile(`${root}/singapore-backup.enc`, encrypted, { mode: 0o600 });
    report.backup_seconds = +((performance.now() - started) / 1000).toFixed(2);
  }
  const recovered = JSON.parse(
    openBackup(await readFile(`${root}/singapore-backup.enc`), await readFile(keyPath)).toString(),
  );
  if (recovered.project !== ref || recovered.format !== 2)
    throw new Error('Recovered project/format guard failed.');
  report.portable_encryption_verified = true;
  report.backup_created_at = recovered.created_at;
  report.tables = recovered.manifest.length;
  report.storage_objects = recovered.files.length;
  const verifiedFiles = verifyBackupFiles(recovered.files);
  report.storage_payload_sha256_verified = true;
  report.storage_payload_bytes_verified = verifiedFiles.bytes;
  phase = 'local database restoration';
  const restoreStarted = performance.now();
  memory = await PGlite.create();
  await memory.exec("SET TIME ZONE 'UTC'");
  // pg_dump contains CREATE SCHEMA public. This target is new, empty and in memory only.
  await memory.exec('DROP SCHEMA public');
  // Generate SQL in memory only; no native/socket server or remote restore endpoint exists.
  const archive = Buffer.from(recovered.dump, 'base64');
  const stripMeta = (sql) => sql.replace(/^\\(?:un)?restrict[^\n]*\n/gm, '');
  await memory.exec('BEGIN');
  for (const section of ['pre-data', 'data', 'post-data']) {
    phase = `local database restoration/${section}`;
    const sql = stripMeta(
      (
        await command(
          'pg_restore',
          ['--file=-', '--no-owner', '--no-acl', `--section=${section}`],
          {},
          archive,
        )
      )
        .toString()
        .replaceAll('\r\n', '\n'),
    );
    if (section !== 'data') {
      await memory.exec(sql);
      continue;
    }
    await restoreCopySection(memory, sql);
  }
  await memory.exec('COMMIT');
  for (const table of recovered.manifest) {
    const identifier = `${quote(table.schemaname)}.${quote(table.tablename)}`;
    const actual = await memory.query(
      `SELECT count(*)::int AS count, encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text COLLATE "C"),''),'UTF8')),'hex') AS digest FROM ${identifier} t`,
    );
    if (actual.rows[0].count !== table.count || actual.rows[0].digest !== table.digest) {
      report.integrity_mismatch = {
        schema: table.schemaname,
        table: table.tablename,
        expected_rows: table.count,
        actual_rows: actual.rows[0].count,
        count_matches: actual.rows[0].count === table.count,
      };
      throw new Error('Restored table integrity mismatch.');
    }
  }
  report.database_restore_verified = true;
  await memory.exec('SET search_path TO public');
  const constraints = (
    await memory.query(
      "SELECT n.nspname AS schema,c.relname AS table_name,x.conname,x.contype,x.convalidated,pg_get_constraintdef(x.oid) AS definition FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth') ORDER BY 1,2,3",
    )
  ).rows;
  // PostgreSQL 18 represents NOT NULL as catalog constraints; source PG17 does not.
  const compatible = constraints.filter((x) => x.contype !== 'n');
  const canonical = (rows) =>
    JSON.stringify(
      rows.map((x) => [x.schema, x.table_name, x.conname, x.contype, x.convalidated, x.definition]),
    );
  if (canonical(compatible) !== canonical(recovered.constraints)) {
    report.constraint_counts = { source: recovered.constraints.length, local: compatible.length };
    report.changed_constraint_names = compatible
      .filter((x) => !recovered.constraints.some((y) => canonical([x]) === canonical([y])))
      .map((x) => x.conname);
    throw new Error('Restored constraints differ.');
  }
  report.constraints_verified = compatible.length;
  const orphans = (
    await memory.query(
      'SELECT (SELECT count(*)::int FROM auth.identities i LEFT JOIN auth.users u ON u.id=i.user_id WHERE u.id IS NULL) AS identities, (SELECT count(*)::int FROM public."User" p LEFT JOIN auth.users u ON u.id::text=p.id WHERE u.id IS NULL) AS application',
    )
  ).rows[0];
  if (orphans.identities || orphans.application)
    throw new Error('Restored identity relationship mismatch.');
  report.identity_relationships_verified = true;
  const rls = (
    await memory.query(
      "SELECT count(*)::int AS count FROM pg_tables t JOIN pg_class c ON c.relname=t.tablename JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname=t.schemaname WHERE t.schemaname='public' AND c.relrowsecurity",
    )
  ).rows[0].count;
  report.public_tables_with_rls = rls;
  phase = 'local freeze/resume';
  await memory.exec(
    'CREATE SCHEMA rehearsal; CREATE TABLE rehearsal.writer_probe (id int PRIMARY KEY)',
  );
  await memory.exec('BEGIN; SET TRANSACTION READ ONLY');
  let denied = false;
  try {
    await memory.exec('INSERT INTO rehearsal.writer_probe VALUES (1)');
  } catch (error) {
    denied = error.code === '25006';
  }
  await memory.exec('ROLLBACK');
  if (!denied) throw new Error('Read-only writer rehearsal failed.');
  await memory.exec(
    'INSERT INTO rehearsal.writer_probe VALUES (1) ON CONFLICT DO NOTHING; INSERT INTO rehearsal.writer_probe VALUES (1) ON CONFLICT DO NOTHING',
  );
  if (
    (await memory.query('SELECT count(*)::int AS count FROM rehearsal.writer_probe')).rows[0]
      .count !== 1
  )
    throw new Error('Resume/idempotency probe failed.');
  await memory.exec('DROP SCHEMA rehearsal CASCADE');
  report.local_freeze_resume_probe_verified = true;
  report.restore_seconds = +((performance.now() - restoreStarted) / 1000).toFixed(2);
} catch (error) {
  await writeFile(
    `${root}/recovery-diagnostic.enc`,
    sealBackup(Buffer.from(String(error?.message || 'unknown')), key),
  );
  report.failed_phase = phase;
  console.error(
    'Portable backup/recovery stopped. Details remain local and encrypted; no secrets reported.',
  );
  process.exitCode = 1;
} finally {
  if (memory) await memory.close();
  if (db) await db.$disconnect();
  await writeFile(
    'docs/supabase-disaster-recovery-evidence.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report, null, 2));
}
