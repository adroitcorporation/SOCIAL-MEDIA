import { spawnSync } from 'node:child_process';
import { validateGcpEnvironment } from '../src/shared/config/gcp-environment.mjs';
validateGcpEnvironment(process.env, { migration: true });
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
process.exit(result.status || (result.error ? 1 : 0));
