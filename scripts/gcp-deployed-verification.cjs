const { loadEnvConfig } = require('@next/env');
const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
loadEnvConfig(process.cwd());
if (process.env.GCP_STAGING_ALLOW_SYNTHETIC_USERS !== 'true')
  throw Error('Explicit staging fixture creation acknowledgement required');
const base = 'https://cynk-staging-backend-1002434130638.asia-south2.run.app';
const project = 'cynk-staging-e9c53';
if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== project) throw Error('Project mismatch');
const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const gc = 'C:\\Users\\arpit\\AppData\\Local\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd';
async function identity(action, body) {
  const r = await fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:' + action + '?key=' + key,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
  const raw = await r.text();
  let b;
  try {
    b = JSON.parse(raw);
  } catch {
    throw Error('State returned non-JSON HTTP ' + r.status);
  }
  if (!r.ok) throw Error('Identity ' + action + ' failed: ' + (b.error?.message || r.status));
  return b;
}
(async () => {
  const accounts = [];
  for (const suffix of ['A', 'B', 'C']) {
    const email =
        'cynk-gcp-' +
        Date.now() +
        '-' +
        suffix.toLowerCase() +
        (suffix === 'C' ? '@example.com' : '@lnmiit.ac.in'),
      password = randomBytes(24).toString('base64url');
    const created = await identity('signUp', { email, password, returnSecureToken: true });
    const unverified = await fetch(base + '/api/state', {
      headers: { Authorization: 'Bearer ' + created.idToken },
    });
    if (unverified.status !== 403) throw Error('Unverified account bypassed email verification');
    // Only newly created synthetic staging identities. No mail sent or real users accessed.
    const access = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-Command', "& '" + gc + "' auth print-access-token"],
      { encoding: 'utf8' },
    ).trim();
    const verified = await fetch(
      'https://identitytoolkit.googleapis.com/v1/projects/' + project + '/accounts:update',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + access,
          'x-goog-user-project': 'cynk-staging',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ localId: created.localId, emailVerified: true }),
      },
    );
    if (!verified.ok) throw Error('Synthetic verification setup failed: ' + verified.status);
    const login = await identity('signInWithPassword', {
      email,
      password,
      returnSecureToken: true,
    });
    if (login.localId !== created.localId) throw Error('Login changed the stable account identity');
    const r = await fetch(base + '/api/state', {
      headers: { Authorization: 'Bearer ' + login.idToken },
    });
    const raw = await r.text();
    let b;
    try {
      b = JSON.parse(raw);
    } catch {
      throw Error('State returned non-JSON HTTP ' + r.status);
    }
    console.log(
      JSON.stringify({
        account: suffix,
        stateStatus: r.status,
        error: b.error,
        keys: Object.keys(b),
      }),
    );
    if (!r.ok) throw Error('Deployed token verification/state failed');
    const refresh = await fetch('https://securetoken.googleapis.com/v1/token?key=' + key, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: login.refreshToken }),
    });
    if (!refresh.ok) throw Error('Firebase session refresh failed');
    const refreshed = await refresh.json();
    const refreshState = await fetch(base + '/api/state', {
      headers: { Authorization: 'Bearer ' + refreshed.id_token },
    });
    if (refreshState.status !== 200) throw Error('Refreshed session rejected');
    accounts.push({ email, password, suffix, token: refreshed.id_token, id: login.localId });
  }
  await require('./gcp-deployed-business-check.cjs')(base, accounts);
  const invalid = await fetch(base + '/api/state', {
    headers: { Authorization: 'Bearer invalid-token' },
  });
  if (invalid.status !== 401) throw Error('Invalid token was accepted');
  if (process.env.SKIP_BROWSER === 'true') return;
  Object.assign(process.env, {
    APP_ENV: 'staging',
    GCP_STAGING_PROJECT_ID: 'cynk-staging',
    GCP_STAGING_AUTH_PROJECT_ID: project,
    GCP_STAGING_FRONTEND_ORIGIN: base,
  });
  for (const a of accounts) {
    process.env['GCP_STAGING_TEST_EMAIL_' + a.suffix] = a.email;
    process.env['GCP_STAGING_TEST_PASSWORD_' + a.suffix] = a.password;
  }
  const { spawnSync } = require('node:child_process');
  const r = spawnSync(
    process.execPath,
    ['node_modules/@playwright/test/cli.js', 'test', '--config=playwright.gcp.config.ts'],
    { env: process.env, stdio: 'inherit' },
  );
  process.exitCode = r.status || 0;
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
