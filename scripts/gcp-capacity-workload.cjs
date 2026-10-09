// Runs inside the constrained container, sharing its memory/CPU with Next.js.
const { PrismaClient } = require('@prisma/client');
const { performance } = require('node:perf_hooks');
const { readFileSync } = require('node:fs');
if (process.env.CAPACITY_FIXTURE !== 'true') throw new Error('Synthetic fixture only');
const url = new URL(process.env.DATABASE_URL);
if (
  url.hostname !== 'localhost' ||
  url.pathname !== '/cynk_staging' ||
  url.searchParams.get('host') !== '/cloudsql/cynk-staging:asia-south2:cynk-staging-db'
)
  throw new Error('Isolated fixture socket required');
const db = new PrismaClient();
async function main() {
  if (process.argv[2] === 'seed') {
    for (let i = 0; i < 50; i++)
      await db.user.create({
        data: {
          id: 'capacity-synthetic-' + i,
          name: 'Synthetic capacity profile ' + i,
          college: 'Synthetic college',
          city: 'Delhi',
          bio: 'Synthetic data only',
          skills: ['TypeScript', 'Design'],
          interests: ['Building'],
          onboarded: true,
          emailVerified: true,
          collegeVerified: true,
          collegeVerificationSource: 'COLLEGE_ID',
        },
      });
    console.log('CAPACITY_SYNTHETIC_PROFILES=50');
    return;
  }
  const sharp = require('sharp');
  const until = performance.now() + 60000;
  const latencies = [];
  let http = 0;
  let database = 0;
  let images = 0;
  const readLoop = async (index) => {
    const routes = ['/api/health', '/login', '/api/config', '/api/profile', '/api/live'];
    while (performance.now() < until) {
      const path = routes[index % routes.length];
      const start = performance.now();
      const response = await fetch('http://127.0.0.1:8080' + path, {
        signal: AbortSignal.timeout(10000),
        redirect: 'manual',
      });
      await response.arrayBuffer();
      const expected = ['/api/profile', '/api/live'].includes(path) ? 401 : 200;
      if (response.status !== expected)
        throw new Error(`Unexpected status ${path}: ${response.status}`);
      http++;
      latencies.push(performance.now() - start);
    }
  };
  const dbLoop = async () => {
    while (performance.now() < until) {
      const profiles = await db.user.findMany({ take: 20, orderBy: { id: 'asc' } });
      if (profiles.length !== 20) throw new Error('Synthetic profile query failed');
      await Promise.all([db.connection.count(), db.idea.count(), db.message.count()]);
      database++;
    }
  };
  const imageLoop = async () => {
    while (performance.now() < until) {
      await sharp({ create: { width: 2048, height: 2048, channels: 3, background: '#aabbcc' } })
        .resize(512, 512)
        .webp()
        .toBuffer();
      images++;
    }
  };
  await Promise.all([
    ...Array.from({ length: 20 }, (_, index) => readLoop(index)),
    dbLoop(),
    imageLoop(),
  ]);
  latencies.sort((a, b) => a - b);
  const read = (path) => {
    try {
      return readFileSync(path, 'utf8').trim();
    } catch {
      return null;
    }
  };
  console.log(
    'CAPACITY_WORKLOAD_RESULT=' +
      JSON.stringify({
        http,
        database,
        images,
        p50Ms: latencies[Math.floor(latencies.length * 0.5)],
        p95Ms: latencies[Math.floor(latencies.length * 0.95)],
        memoryPeakBytes:
          read('/sys/fs/cgroup/memory.peak') ||
          read('/sys/fs/cgroup/memory/memory.max_usage_in_bytes'),
        memoryLimitBytes:
          read('/sys/fs/cgroup/memory.max') || read('/sys/fs/cgroup/memory/memory.limit_in_bytes'),
        cpuMax: read('/sys/fs/cgroup/cpu.max'),
        caveat:
          'Anonymous HTTP + rejected protected requests + direct synthetic Prisma/image workload. ' +
          'No successful Firebase login, authorized SSE stream or GCS network upload is proven.',
      }),
  );
}
main()
  .catch(() => {
    console.error('CAPACITY_WORKLOAD_FAILED');
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
