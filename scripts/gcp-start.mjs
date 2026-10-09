import { spawn } from 'node:child_process';
import { validateGcpEnvironment } from '../src/shared/config/gcp-environment.mjs';
validateGcpEnvironment(process.env);
if (process.env.RECOMMENDATION_WORKER_ENABLED !== 'false')
  throw new Error('Use the separate recommendation job on Cloud Run.');
// Migrations deliberately run as a separate job with a different SQL/IAM identity.
const child = spawn(process.execPath, ['.next/standalone/server.js'], {
  stdio: 'inherit',
  env: { ...process.env, HOSTNAME: '0.0.0.0', PORT: process.env.PORT || '8080' },
});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code || 0));
