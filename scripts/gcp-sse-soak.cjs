const assert = require('node:assert/strict');
const fs = require('node:fs');

module.exports = async function (base, accounts) {
  assert.equal(base, 'https://cynk-staging-backend-1002434130638.asia-south2.run.app');
  assert.equal(accounts.length, 3);
  const evidence = { startedAt: new Date().toISOString(), simultaneous: 20, cycles: [] };
  // Six server-limited 55-second cycles: bounded duration and identities, no scaling changes.
  for (let cycle = 0; cycle < 6; cycle++) {
    const samples = await Promise.all(
      Array.from({ length: 20 }, async (_, i) => {
        const start = performance.now();
        const response = await fetch(base + '/api/live', {
          headers: { Authorization: 'Bearer ' + accounts[i % 3].token },
          signal: AbortSignal.timeout(75000),
        });
        assert.equal(response.status, 200);
        let ready = false;
        const reader = response.body.getReader();
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          if (Buffer.from(chunk.value).toString().includes('event: ready')) ready = true;
        }
        assert.ok(ready);
        const duration = performance.now() - start;
        assert.ok(duration >= 50000);
        return duration;
      }),
    );
    evidence.cycles.push({
      cycle: cycle + 1,
      connections: samples.length,
      minimumDurationMs: Math.min(...samples),
    });
    evidence.lastCompletedAt = new Date().toISOString();
    fs.writeFileSync('.local/readiness-sse-soak.json', JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence.cycles.at(-1)));
  }
};
