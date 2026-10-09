const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
module.exports = async function (base, accounts) {
  const api = async (a, path, method = 'GET', body, expected = 200) => {
    const r = await fetch(base + '/api/' + path, {
      method,
      headers: {
        Authorization: 'Bearer ' + a.token,
        Origin: base,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await r.text();
    let b;
    try {
      b = JSON.parse(text);
    } catch {
      throw Error(path + ' non-JSON HTTP ' + r.status);
    }
    if (r.status !== expected) throw Error(path + ' HTTP ' + r.status + ' ' + (b.error || ''));
    return b;
  };
  const [a, b] = accounts;
  assert.equal((await api(accounts[2], 'state')).me.collegeVerified, false);
  for (const account of accounts.slice(0, 2)) {
    const state = await api(account, 'state');
    assert.equal(state.me.collegeVerified, true);
    await api(account, 'profile', 'PATCH', {
      name: 'Synthetic Staging ' + account.suffix,
      college: 'The LNM Institute of Information Technology',
      degree: 'BTech',
      graduationYear: 2028,
      city: 'Jaipur',
      bio: 'Synthetic isolated deployment verification account',
      skills: ['TypeScript'],
      interests: ['Startups'],
      domains: ['Technology'],
      lookingFor: ['Collaborators'],
    });
  }
  const connection = await api(a, 'connections', 'POST', { userId: b.id });
  await api(a, 'connections/' + connection.id, 'PATCH', { action: 'accept' }, 403);
  await api(b, 'connections/' + connection.id, 'PATCH', { action: 'accept' });
  const convo = await api(a, 'conversations', 'POST', { type: 'DIRECT', userId: b.id });
  await api(accounts[2], 'conversations/' + convo.id + '/messages', 'GET', undefined, 403);
  const message = await api(a, 'conversations/' + convo.id + '/messages', 'POST', {
    body: 'Synthetic staging message',
    clientId: randomUUID(),
  });
  const messages = await api(b, 'conversations/' + convo.id + '/messages');
  assert.ok(JSON.stringify(messages).includes(message.id));
  const idea = await api(a, 'ideas', 'POST', {
    title: 'Synthetic deployment verification',
    description: 'Staging-only idea for integration testing',
    category: 'Startup',
    skills: ['TypeScript'],
    tags: ['staging'],
  });
  await api(b, 'ideas/' + idea.id + '/resonate', 'POST', { enabled: true });
  const group = await api(a, 'ideas/' + idea.id + '/group', 'POST', { memberIds: [b.id] });
  await api(b, 'conversations/' + group.id + '/messages', 'POST', {
    body: 'Synthetic group test',
    clientId: randomUUID(),
  });
  await api(a, 'moderation/verifications', 'GET', undefined, 403);
  const notifications = await api(b, 'state');
  assert.ok(notifications.notifications.length > 0);
  const png = await require('sharp')({
    create: { width: 64, height: 64, channels: 3, background: '#8899aa' },
  })
    .png()
    .toBuffer();
  const upload = await fetch(base + '/api/profile/photo', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + a.token,
      Origin: base,
      'Content-Type': 'application/octet-stream',
      'x-profile-photo-type': 'image/png',
    },
    body: png,
  });
  assert.equal(upload.status, 200, 'GCS profile upload');
  const photo = await upload.json();
  const image = await fetch(photo.url);
  assert.equal(image.status, 200);
  assert.ok((await image.arrayBuffer()).byteLength > 0);
  const verification = await api(accounts[2], 'verification', 'POST', {
    method: 'COLLEGE_ID',
    documentUrl: 'data:image/png;base64,' + png.toString('base64'),
  });
  await api(a, 'moderation/verifications/' + verification.id + '/document', 'GET', undefined, 403);
  await api(b, 'moderation/verifications/' + verification.id + '/document', 'GET', undefined, 403);
  const abort = new AbortController();
  const live = await fetch(base + '/api/live', {
    headers: { Authorization: 'Bearer ' + a.token },
    signal: abort.signal,
  });
  assert.equal(live.status, 200);
  assert.ok(live.headers.get('content-type').includes('text/event-stream'));
  const chunk = await live.body.getReader().read();
  assert.ok(Buffer.from(chunk.value).toString().includes('event: ready'));
  abort.abort();
  console.log(
    'Deployed profiles, college verification, connection authorization, direct/group messaging, ideas, notifications, GCS profile/private-document uploads and SSE passed.',
  );
};
