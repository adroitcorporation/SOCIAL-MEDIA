// Read-only, local-origin observations; never a Render-origin performance claim.
import { loadEnvFile } from 'node:process';
import { performance } from 'node:perf_hooks';
import { PrismaClient } from '@prisma/client';

const projects = {
  seoul: [
    'DATABASE_URL',
    'postgres.rznbuzkgzsryadokvcfh',
    'aws-0-ap-northeast-2.pooler.supabase.com',
  ],
  singapore: [
    'MIGRATION_DESTINATION_DATABASE_URL',
    'postgres.lxofcmzgzbgqvlmwizgm',
    'aws-0-ap-southeast-1.pooler.supabase.com',
  ],
};
const clients = [];
try {
  loadEnvFile();
  const samples = Object.fromEntries(Object.keys(projects).map((name) => [name, []]));
  for (const [name, [variable, username, host]] of Object.entries(projects)) {
    const url = new URL(process.env[variable] || '');
    if (
      decodeURIComponent(url.username) !== username ||
      url.hostname !== host ||
      url.pathname !== '/postgres'
    ) {
      throw new Error('Project guard failed');
    }
    url.port = '5432'; // Compare identical session-pooler topology.
    url.searchParams.set('sslmode', 'require');
    url.searchParams.set('connection_limit', '1');
    url.searchParams.set('pool_timeout', '10');
    const client = new PrismaClient({ datasources: { db: { url: url.href } }, log: [] });
    clients.push({ name, client });
    for (let warmup = 0; warmup < 3; warmup++) await client.$queryRaw`SELECT 1`;
  }
  for (let iteration = 0; iteration < 30; iteration++) {
    const order = iteration % 2 ? [...clients].reverse() : clients;
    for (const { name, client } of order) {
      const started = performance.now();
      await client.$queryRaw`SELECT 1`;
      samples[name].push(Number((performance.now() - started).toFixed(2)));
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const percentile = (values, fraction) =>
    [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
  console.log(
    JSON.stringify(
      {
        measured_at: new Date().toISOString(),
        origin: 'local Windows client, not Render',
        query: 'SELECT 1',
        warmups_per_project: 3,
        samples_per_project: 30,
        pooling: 'session pooler, port 5432, TLS required, connection_limit=1',
        errors: 0,
        results: Object.fromEntries(
          Object.entries(samples).map(([name, values]) => [
            name,
            {
              p50_ms: percentile(values, 0.5),
              p95_ms: percentile(values, 0.95),
              samples_ms: values,
            },
          ]),
        ),
      },
      null,
      2,
    ),
  );
} catch {
  console.error(
    'Read-only benchmark failed; connection details were withheld. No result is claimed.',
  );
  process.exitCode = 1;
} finally {
  await Promise.all(clients.map(({ client }) => client.$disconnect()));
}
