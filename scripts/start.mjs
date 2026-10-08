import { spawnSync, spawn } from 'node:child_process';
import {
  matchesProjectUrl,
  matchesProjectDatabase,
} from '../src/shared/config/supabase-project.mjs';
const expected = process.env.SUPABASE_EXPECTED_PROJECT_REF;
if (
  expected &&
  (!matchesProjectDatabase(process.env.DATABASE_URL, expected) ||
    !matchesProjectDatabase(process.env.DIRECT_URL, expected) ||
    !matchesProjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, expected) ||
    !matchesProjectUrl(
      process.env.SUPABASE_STORAGE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
      expected,
    ))
) {
  console.error('Database/Auth/Storage project mismatch. Refusing startup and migrations.');
  process.exit(1);
}
const required = [
  'DATABASE_URL',
  'DIRECT_URL',
  'APP_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
];
for (const key of required)
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
if (process.env.LOCAL_DEMO === 'true') {
  console.error('LOCAL_DEMO must be disabled for production startup.');
  process.exit(1);
}
const migration = spawnSync(
  process.execPath,
  [
    'node_modules/prisma/build/index.js',
    'migrate',
    'deploy',
    '--schema',
    'src/backend/database/prisma/schema.prisma',
  ],
  { stdio: 'inherit' },
);
if (migration.status !== 0) process.exit(migration.status || 1);
const child = spawn(
  process.execPath,
  [
    'node_modules/next/dist/bin/next',
    'start',
    '--hostname',
    '0.0.0.0',
    '--port',
    process.env.PORT || '3000',
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      RECOMMENDATION_WORKER_ENABLED: process.env.RECOMMENDATION_WORKER_ENABLED || 'true',
    },
  },
);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code || 0));
