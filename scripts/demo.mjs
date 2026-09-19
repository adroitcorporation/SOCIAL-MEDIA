import { spawnSync, spawn } from 'node:child_process';
const env = {
  ...process.env,
  DATABASE_URL:
    'postgresql://postgres:postgres@127.0.0.1:54329/postgres?connection_limit=1&pgbouncer=true&statement_cache_size=0',
  LOCAL_DEMO: 'true',
  APP_URL: 'http://localhost:3000',
};
for (const args of [
  ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
  ['node_modules/tsx/dist/cli.mjs', 'prisma/seed.ts'],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1'],
  { env, stdio: 'inherit' },
);
child.on('exit', (code) => process.exit(code || 0));
