// Anonymous GET-only staging probe. No credentials, user data, or writes.
const expected = process.env.BENCHMARK_STAGING_ORIGIN;
const input = process.argv[2];
if (process.env.APP_ENV !== 'staging' || !expected || input !== expected)
  throw new Error('Explicit staging benchmark origin is required.');
const url = new URL(input);
if (
  url.protocol !== 'https:' ||
  url.username ||
  url.password ||
  url.pathname !== '/' ||
  url.search ||
  url.hash
)
  throw new Error('Canonical HTTPS staging origin required.');
for (const route of ['/api/config', '/api/health']) {
  const samples = [];
  for (let i = 0; i < 20; i++) {
    const start = performance.now();
    const response = await fetch(url.origin + route, {
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error('Staging probe failed: HTTP ' + response.status);
    await response.arrayBuffer();
    samples.push(performance.now() - start);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const sorted = [...samples].sort((a, b) => a - b);
  console.log(
    JSON.stringify({
      route,
      samples: samples.length,
      firstMs: Math.round(samples[0]),
      medianMs: Math.round(sorted[10]),
      p95Ms: Math.round(sorted[18]),
      maxMs: Math.round(sorted[19]),
    }),
  );
}
