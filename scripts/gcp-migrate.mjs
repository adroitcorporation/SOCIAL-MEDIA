import { spawnSync } from 'node:child_process';
import { validateGcpEnvironment } from '../src/shared/config/gcp-environment.mjs';
import { initializeFreshStagingDatabase } from './gcp-fresh-database.mjs';
validateGcpEnvironment(process.env, { migration: true });
if (process.env.INITIALIZE_FRESH_DATABASE === 'true') await initializeFreshStagingDatabase();
const result = spawnSync(
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
if (result.status !== 0 || result.error) process.exit(result.status || 1);
if (process.env.APPLY_RUNTIME_PRIVILEGES === 'true') {
  const privileges = spawnSync(
    process.execPath,
    [
      'node_modules/prisma/build/index.js',
      'db',
      'execute',
      '--schema',
      'src/backend/database/prisma/schema.prisma',
      '--file',
      'deployment/gcp/database-access.sql',
    ],
    { stdio: 'inherit', env: { ...process.env, DATABASE_URL: process.env.DIRECT_URL } },
  );
  if (privileges.status !== 0 || privileges.error) process.exit(privileges.status || 1);
}
process.exit(0);
