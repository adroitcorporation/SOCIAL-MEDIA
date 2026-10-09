const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const { chromium } = require('@playwright/test');
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
module.exports = async function (base, accounts) {
  if (
    base !== 'https://cynk-staging-backend-1002434130638.asia-south2.run.app' ||
    accounts.length !== 3
  )
    throw Error('Explicit staging fixtures required');
  const gc =
    'C:\\Users\\arpit\\AppData\\Local\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd';
  const oauth = () =>
    execFileSync(
      'powershell.exe',
      ['-NoProfile', '-Command', "& '" + gc + "' auth print-access-token"],
      { encoding: 'utf8' },
    ).trim();
  const evidence = {
    startedAt: new Date().toISOString(),
    roles: false,
    frontend: false,
    load: [],
    sse: [],
  };
  const api = async (a, path, method = 'GET', body, expected = 200) => {
    const r = await fetch(base + '/api/' + path, {
      method,
      signal: AbortSignal.timeout(30000),
      headers: {
        Authorization: 'Bearer ' + a.token,
        Origin: base,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (r.status !== expected) throw Error(path + ' HTTP ' + r.status + ' expected ' + expected);
    return r.json();
  };
  const setRoles = async (roles) => {
    const ids = accounts.map((a) => a.id);
    if (ids.some((id) => !/^\w{1,128}$/.test(id))) throw Error('Invalid fixture UID');
    const code = `const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{try{const roles=${JSON.stringify(roles)},ids=${JSON.stringify(ids)};await p.$transaction(async tx=>{for(let i=0;i<ids.length;i++){const u=await tx.user.findUniqueOrThrow({where:{id:ids[i]}});if(!['Synthetic Staging A','Synthetic Staging B','New student'].includes(u.name))throw Error('Not a newly created fixture');await tx.user.update({where:{id:ids[i]},data:{role:roles[i]}})}});console.log('Owned fixture roles updated');}finally{await p.$disconnect()}})().catch(()=>process.exit(1));`;
    const token = oauth(),
      headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
    const r = await fetch(
      'https://run.googleapis.com/v2/projects/cynk-staging/locations/asia-south2/jobs/cynk-staging-migrate:run',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          overrides: {
            containerOverrides: [{ args: ['node', '-e', code] }],
            taskCount: 1,
            timeout: '120s',
          },
        }),
      },
    );
    if (!r.ok) throw Error('Fixture role execution denied');
    let op = await r.json();
    for (let i = 0; !op.done && i < 120; i++) {
      await delay(1000);
      op = await (await fetch('https://run.googleapis.com/v2/' + op.name, { headers })).json();
    }
    if (op.error || !op.done) throw Error('Fixture role execution failed');
    let execution = op.response;
    for (let i = 0; !execution?.completionTime && i < 120; i++) {
      await delay(1000);
      execution = await (
        await fetch('https://run.googleapis.com/v2/' + execution.name, { headers })
      ).json();
    }
    if (!execution?.completionTime || execution.failedCount || execution.succeededCount !== 1)
      throw Error('Fixture role assignment failed');
  };
  const [admin, owner, moderator] = accounts;
  try {
    await setRoles(['ULTIMATE_MODERATOR', 'ORGANISER', 'MODERATOR']);
    const event = {
      title: 'Owned readiness fixture',
      description: 'Synthetic readiness event',
      category: 'Workshop',
      organizer: 'Synthetic staging',
      location: 'Delhi test fixture',
      startsAt: '2027-01-01T10:00:00Z',
      url: 'https://example.com/staging',
    };
    await api(moderator, 'events', 'POST', event, 403);
    const created = await api(owner, 'events', 'POST', event);
    const adminEvent = await api(admin, 'events', 'POST', {
      ...event,
      title: 'Admin-owned fixture',
    });
    await api(owner, 'events/' + adminEvent.id, 'PATCH', event, 403);
    await api(owner, 'events/' + adminEvent.id, 'DELETE', {}, 403);
    await api(owner, 'events/' + created.id, 'PATCH', { ...event, title: 'Edited owner fixture' });
    assert.ok((await api(owner, 'events/managed')).some((e) => e.id === created.id));
    await api(admin, 'events/' + created.id, 'PATCH', {
      ...event,
      title: 'Admin edit of owner fixture',
    });
    const report = await api(owner, 'reports', 'POST', {
      targetId: moderator.id,
      reason: 'Synthetic report for authorization testing',
    });
    await api(owner, 'moderation/reports', 'GET', undefined, 403);
    await api(moderator, 'moderation/reports/' + report.id, 'PATCH', {
      status: 'REVIEWED',
      reviewNote: 'Synthetic review',
    });
    await api(
      moderator,
      'moderation/users/' + owner.id + '/role',
      'PATCH',
      { role: 'STUDENT', reason: 'Should be denied' },
      403,
    );
    const verification = await api(moderator, 'verification');
    const file = await fetch(
      base + '/api/moderation/verifications/' + verification.id + '/document',
      { headers: { Authorization: 'Bearer ' + moderator.token } },
    );
    assert.equal(file.status, 200);
    assert.ok((await file.arrayBuffer()).byteLength > 0);
    await api(admin, 'moderation/verifications/' + verification.id, 'PATCH', {
      status: 'APPROVED',
      reviewNote: 'Synthetic fixture review',
    });
    await api(owner, 'events/' + created.id, 'DELETE', {});
    await api(admin, 'events/' + adminEvent.id, 'DELETE', {});
    evidence.roles = true;
    const browser = await chromium.launch();
    try {
      for (const a of accounts) {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(base + '/login');
        await page.getByLabel('Email address').fill(a.email);
        await page.getByLabel('Password', { exact: true }).fill(a.password);
        await page.getByRole('button', { name: 'Sign in', exact: true }).click();
        await page.waitForURL((u) => u.pathname !== '/login');
        for (let attempt = 0; attempt < 100; attempt++) {
          if ((await context.cookies()).some((c) => c.name === 'circle-page-session')) break;
          await delay(100);
        }
        assert.ok(
          (await context.cookies()).some((c) => c.name === 'circle-page-session'),
          'Authenticated page cookie',
        );
        await page.goto(base + '/events');
        if (a !== moderator)
          await page
            .getByRole('heading', { name: 'Manage events', exact: true })
            .waitFor({ state: 'visible' });
        assert.equal(
          await page.getByRole('heading', { name: 'Manage events', exact: true }).count(),
          a === moderator ? 0 : 1,
        );
        await page.goto(base + '/moderation');
        await page
          .getByRole('heading', {
            name: a === owner ? 'Access denied' : 'Moderation dashboard',
            exact: true,
          })
          .waitFor({ state: 'visible' })
          .catch(async (error) => {
            console.log(
              JSON.stringify({
                fixture: a.suffix,
                headings: await page.locator('h1,h2').allTextContents(),
                sessionCookiePresent: (await context.cookies()).some(
                  (c) => c.name === 'circle-page-session',
                ),
              }),
            );
            throw error;
          });
        await context.close();
      }
      evidence.frontend = true;
    } finally {
      await browser.close();
    }
  } finally {
    await setRoles(['STUDENT', 'STUDENT', 'STUDENT']);
    fs.writeFileSync('.local/readiness-events.json', JSON.stringify(evidence, null, 2));
  }
  // Modest concurrency first. No scaling changes; stop rather than amplify errors.
  for (const route of ['students/' + owner.id, 'recommendations/people']) {
    const samples = [];
    for (let i = 0; i < 50; i++) {
      const start = performance.now();
      await api(accounts[i % 3], route);
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    evidence.load.push({
      route,
      samples: 50,
      concurrency: 1,
      p50: samples[24],
      p95: samples[47],
      p99: samples[49],
    });
  }
  for (const virtualUsers of [100, 500, 1000]) {
    let index = 0,
      errors = 0;
    const samples = [],
      statuses = {};
    const concurrency = 10;
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (index < virtualUsers && errors < 3) {
          const i = index++,
            a = accounts[i % 3],
            start = performance.now();
          try {
            const r = await fetch(base + '/api/students/' + owner.id, {
              headers: { Authorization: 'Bearer ' + a.token },
              signal: AbortSignal.timeout(10000),
            });
            await r.arrayBuffer();
            statuses[r.status] = (statuses[r.status] || 0) + 1;
            if (!r.ok) errors++;
            else samples.push(performance.now() - start);
          } catch {
            errors++;
            statuses.network = (statuses.network || 0) + 1;
          }
        }
      }),
    );
    samples.sort((a, b) => a - b);
    const quantile = (p) => samples[Math.max(0, Math.ceil(samples.length * p) - 1)];
    evidence.load.push({
      virtualUsers,
      distinctIdentities: 3,
      concurrency,
      completed: samples.length,
      errors,
      statuses,
      p50: quantile(0.5),
      p95: quantile(0.95),
      p99: quantile(0.99),
    });
    console.log(JSON.stringify(evidence.load.at(-1)));
    fs.writeFileSync('.local/readiness-events.json', JSON.stringify(evidence, null, 2));
    if (errors) {
      evidence.higherLoadStopped =
        'Error threshold reached; shared-identity rate limits are not a distinct-user capacity measurement';
      break;
    }
  }
  for (const count of [10, 20]) {
    const results = await Promise.all(
      Array.from({ length: count }, async (_, i) => {
        const a = accounts[i % 3],
          start = performance.now(),
          r = await fetch(base + '/api/live', {
            headers: { Authorization: 'Bearer ' + a.token },
            signal: AbortSignal.timeout(75000),
          });
        if (r.status !== 200) throw Error('SSE rejected');
        const reader = r.body.getReader();
        let ready = false;
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          if (Buffer.from(chunk.value).toString().includes('event: ready')) ready = true;
        }
        return { ready, durationMs: performance.now() - start };
      }),
    );
    assert.ok(results.every((r) => r.ready && r.durationMs >= 50000));
    for (let i = 0; i < count; i++) {
      const abort = new AbortController(),
        r = await fetch(base + '/api/live', {
          headers: { Authorization: 'Bearer ' + accounts[i % 3].token },
          signal: abort.signal,
        });
      assert.equal(r.status, 200);
      const first = await r.body.getReader().read();
      assert.ok(Buffer.from(first.value).toString().includes('event: ready'));
      abort.abort();
    }
    evidence.sse.push({
      simultaneous: count,
      naturalClose: true,
      reconnect: true,
      minimumDurationMs: Math.min(...results.map((r) => r.durationMs)),
    });
    console.log(JSON.stringify(evidence.sse.at(-1)));
    fs.writeFileSync('.local/readiness-events.json', JSON.stringify(evidence, null, 2));
  }
  evidence.finishedAt = new Date().toISOString();
  fs.writeFileSync('.local/readiness-events.json', JSON.stringify(evidence, null, 2));
};
