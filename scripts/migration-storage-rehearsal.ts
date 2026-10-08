// Singapore-only synthetic fixtures. No historical Storage downloads, copies or deletions.
import { loadEnvFile } from 'node:process';
import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { matchesProjectDatabase } from '../src/shared/config/supabase-project.mjs';

const ref = 'lxofcmzgzbgqvlmwizgm';
const url = `https://${ref}.supabase.co`;
loadEnvFile();
const databaseUrl = process.env.MIGRATION_DESTINATION_DATABASE_URL;
const secret = process.env.MIGRATION_DESTINATION_STORAGE_KEY;
if (!matchesProjectDatabase(databaseUrl, ref) || !secret?.startsWith('sb_secret_'))
  throw new Error('Destination guard failed. No rehearsal started.');
const publicConfig = JSON.parse(await readFile('.local/staging-public.json', 'utf8')) as {
  url: string;
  key: string;
};
if (publicConfig.url !== url || !publicConfig.key.startsWith('sb_publishable_'))
  throw new Error('Public project guard failed.');
Object.assign(process.env, {
  DATABASE_URL: databaseUrl,
  DIRECT_URL: databaseUrl,
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicConfig.key,
  SUPABASE_STORAGE_URL: url,
  SUPABASE_SERVICE_ROLE_KEY: secret,
  SUPABASE_EXPECTED_PROJECT_REF: ref,
  FILE_STORAGE_MODE: 'supabase',
  APP_URL: 'http://localhost:3001',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3001',
  LOCAL_DEMO: 'false',
  RECOMMENDATION_WORKER_ENABLED: 'false',
  AI_PROVIDER: 'disabled',
  AI_API_KEY: '',
});
const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const accepted = await admin.storage.listBuckets();
if (accepted.error) throw new Error('Destination rejected backend credential.');
const migration = spawnSync(
  process.execPath,
  [
    'node_modules/prisma/build/index.js',
    'migrate',
    'deploy',
    '--schema',
    'src/backend/database/prisma/schema.prisma',
  ],
  { env: process.env, stdio: 'pipe' },
);
if (migration.status !== 0)
  throw new Error('Staging-only Prisma migration failed; details withheld.');
const { db } = await import('../src/backend/database/client');
const { handleApiRequest } = await import('../src/backend/http/api-handler');
const { connectionReadyProfile } = await import('../tests/fixtures/connection-ready');
let failedCheck = 'unexpected service error';
const check = (condition: unknown, label: string) => {
  if (!condition) {
    failedCheck = label;
    throw new Error(label);
  }
};
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const ids: string[] = [];
const clients: Array<typeof admin> = [];
const files: Array<{
  bucket: 'profile-photos' | 'college-ids' | 'event-attachments';
  path: string;
}> = [];
const fixtureTargets: string[] = [];
const checks: Record<string, boolean> = {};
const baseline = await db.$queryRaw<
  Array<{ users: bigint; verified: bigint; auth_users: bigint; objects: bigint }>
>`
 SELECT (SELECT count(*) FROM public."User") AS users,
 (SELECT count(*) FROM public."User" WHERE "collegeVerified") AS verified,
 (SELECT count(*) FROM auth.users) AS auth_users, (SELECT count(*) FROM storage.objects) AS objects`;
let successful = false;
let phase = 'fixture creation';
try {
  const tokens: string[] = [];
  const passwords: string[] = [];
  const emails: string[] = [];
  for (let index = 0; index < 2; index++) {
    const email = `migration-${randomUUID()}@example.invalid`;
    const password = randomBytes(32).toString('base64url');
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    check(!created.error && created.data.user, 'fixture Auth creation');
    const id = created.data.user!.id;
    ids.push(id);
    emails.push(email);
    passwords.push(password);
    const client = createClient(url, publicConfig.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    clients.push(client);
    const login = await client.auth.signInWithPassword({ email, password });
    check(
      !login.error && login.data.user?.id === id && login.data.session,
      'fixture password login',
    );
    tokens.push(login.data.session!.access_token);
    await db.user.create({
      data: {
        id,
        ...connectionReadyProfile,
        name: `Migration fixture ${index}`,
        role: index === 0 ? 'ORGANISER' : 'STUDENT',
        emailVerified: true,
        onboarded: true,
      },
    });
  }
  await writeFile(
    '.local/storage-rehearsal-fixtures.json',
    JSON.stringify({ destination_project: ref, auth_user_ids: ids, synthetic_only: true }),
  );
  async function api(
    index: number,
    path: string,
    method = 'GET',
    body?: unknown,
    raw?: Uint8Array,
    mime?: string,
  ) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${tokens[index]}`,
      Origin: 'http://localhost:3001',
    };
    if (raw) {
      headers['Content-Type'] = 'application/octet-stream';
      headers[path === 'profile/photo' ? 'X-Profile-Photo-Type' : 'X-Event-Attachment-Type'] =
        mime!;
    } else if (body !== undefined) headers['Content-Type'] = 'application/json';
    const payload = raw
      ? new Uint8Array(raw).buffer
      : body !== undefined
        ? JSON.stringify(body)
        : undefined;
    const request = new Request(`http://localhost:3001/api/${path}`, {
      method,
      headers,
      body: payload,
    });
    return handleApiRequest(request, path.split('?')[0].split('/'));
  }
  phase = 'profile upload';
  const png = await sharp({ create: { width: 3, height: 3, channels: 3, background: 'blue' } })
    .png()
    .toBuffer();
  const profile = await api(0, 'profile/photo', 'POST', undefined, png, 'image/png');
  check(profile.status === 200, 'profile upload');
  const photo = (await profile.json()) as { url: string };
  const photoUrl = new URL(photo.url);
  check(photoUrl.hostname === `${ref}.supabase.co`, 'profile project');
  files.push({
    bucket: 'profile-photos',
    path: decodeURIComponent(photoUrl.pathname.split('/profile-photos/')[1]),
  });
  const photoRead = await fetch(photo.url, { cache: 'no-store' });
  check(photoRead.ok, 'public photo read');
  const photoBytes = new Uint8Array(await photoRead.arrayBuffer());
  check(sha(photoBytes) === sha(png), 'profile file integrity');
  checks.profile_upload_download_integrity = true;
  phase = 'private verification';
  const pending = await api(0, 'verification', 'POST', {
    method: 'COLLEGE_ID',
    documentUrl: `data:image/png;base64,${png.toString('base64')}`,
  });
  check(pending.status === 200, 'private college ID submission');
  const request = (await pending.json()) as { id: string };
  fixtureTargets.push(request.id);
  const stored = await db.collegeVerificationRequest.findUniqueOrThrow({
    where: { id: request.id },
  });
  check(
    !stored.documentBytes && stored.documentUrl?.startsWith('storage://college-ids/'),
    'private bytes exclusively in Storage',
  );
  const documentPath = stored.documentUrl!.slice('storage://college-ids/'.length);
  files.push({ bucket: 'college-ids', path: documentPath });
  check(
    (await api(0, `moderation/verifications/${request.id}/document`)).status === 403,
    'non-moderator document denial',
  );
  check(
    (await api(1, `moderation/verifications/${request.id}/document`)).status === 403,
    'other student document denial',
  );
  for (const client of clients) {
    check(
      Boolean((await client.storage.from('college-ids').download(documentPath)).error),
      'direct private download denied',
    );
    check(
      Boolean((await client.storage.from('college-ids').createSignedUrl(documentPath, 60)).error),
      'unprivileged signing denied',
    );
  }
  const forbidden = await fetch(`${url}/storage/v1/object/public/college-ids/${documentPath}`);
  check(!forbidden.ok, 'private bucket cannot be served publicly');
  await db.user.update({
    where: { id: ids[1] },
    data: { role: 'MODERATOR', collegeVerified: true, collegeVerificationSource: 'COLLEGE_ID' },
  });
  const document = await api(1, `moderation/verifications/${request.id}/document`);
  check(document.status === 200, 'moderator private download');
  const documentBytes = new Uint8Array(await document.arrayBuffer());
  check(sha(documentBytes) === sha(png), 'private document integrity');
  checks.private_document_authorization_and_integrity = true;
  phase = 'signed URL expiry and Storage recovery';
  const signed = await admin.storage.from('college-ids').createSignedUrl(documentPath, 2);
  check(!signed.error && signed.data, 'operator signed URL');
  check((await fetch(signed.data!.signedUrl, { cache: 'no-store' })).ok, 'signed URL read');
  await new Promise((resolve) => setTimeout(resolve, 3500));
  check(!(await fetch(signed.data!.signedUrl, { cache: 'no-store' })).ok, 'signed URL expiry');
  checks.signed_url_expiry = true;
  check(
    !(await admin.storage.from('college-ids').remove([documentPath])).error,
    'fixture object removal',
  );
  check(
    (await api(1, `moderation/verifications/${request.id}/document`)).status === 502,
    'missing fixture object fails closed',
  );
  check(
    !(
      await admin.storage.from('college-ids').upload(documentPath, documentBytes, {
        contentType: 'image/png',
        cacheControl: '0',
        upsert: false,
      })
    ).error,
    'fixture Storage recovery',
  );
  const recovered = await api(1, `moderation/verifications/${request.id}/document`);
  check(
    recovered.status === 200 &&
      sha(new Uint8Array(await recovered.arrayBuffer())) === sha(documentBytes),
    'recovered private bytes',
  );
  checks.synthetic_storage_recovery = true;
  phase = 'event attachment ownership';
  const eventResponse = await api(0, 'events', 'POST', {
    title: 'Migration fixture event',
    description: 'Synthetic migration rehearsal only.',
    category: 'Workshop',
    organizer: 'Migration fixture',
    location: 'Staging',
    startsAt: '2027-01-01T10:00:00.000Z',
    url: 'https://example.invalid',
  });
  check(eventResponse.status === 200, 'fixture event creation');
  const event = (await eventResponse.json()) as { id: string };
  fixtureTargets.push(event.id);
  const pdf = new TextEncoder().encode('%PDF-1.7\nSynthetic migration fixture');
  const upload = await api(
    0,
    `events/${event.id}/attachments?name=fixture.pdf`,
    'POST',
    undefined,
    pdf,
    'application/pdf',
  );
  check(upload.status === 200, 'event attachment upload');
  const attachment = (await upload.json()) as { id: string };
  const attachmentRow = await db.eventAttachment.findUniqueOrThrow({
    where: { id: attachment.id },
  });
  check(
    attachmentRow.storagePath && attachmentRow.bytes.length === 0,
    'attachment bytes exclusively in Storage',
  );
  files.push({ bucket: 'event-attachments', path: attachmentRow.storagePath! });
  const download = await api(1, `events/${event.id}/attachments/${attachment.id}`);
  check(
    download.status === 200 && sha(new Uint8Array(await download.arrayBuffer())) === sha(pdf),
    'authenticated community attachment download',
  );
  check(
    (await api(1, `events/${event.id}/attachments/${attachment.id}`, 'DELETE', {})).status === 403,
    'non-owner deletion denied',
  );
  check(
    (await api(0, `events/${event.id}/attachments/${attachment.id}`, 'DELETE', {})).status === 200,
    'owner attachment deletion',
  );
  check(
    (await api(1, `events/${event.id}/attachments/${attachment.id}`)).status === 404,
    'deleted attachment unavailable',
  );
  checks.attachment_upload_download_delete_authorization = true;
  phase = 'connection and messaging';
  check(
    (await api(0, 'connections', 'POST', { userId: ids[1] })).status === 403,
    'unverified connection gate',
  );
  const review = await api(1, `moderation/verifications/${request.id}`, 'PATCH', {
    status: 'APPROVED',
    reviewNote: 'Synthetic fixture only',
  });
  check(review.status === 200, 'fixture verification approval');
  const connection = await api(0, 'connections', 'POST', { userId: ids[1] });
  check(connection.status === 200, 'connection request');
  const connectionRow = (await connection.json()) as { id: string };
  check(
    (await api(1, `connections/${connectionRow.id}`, 'PATCH', { action: 'accept' })).status === 200,
    'connection accept',
  );
  const conversationResponse = await api(0, 'conversations', 'POST', {
    type: 'DIRECT',
    userId: ids[1],
  });
  check(conversationResponse.status === 200, 'direct conversation');
  const conversation = (await conversationResponse.json()) as { id: string };
  fixtureTargets.push(conversation.id);
  const message = await api(0, `conversations/${conversation.id}/messages`, 'POST', {
    body: 'Synthetic staging message',
    clientId: randomUUID(),
  });
  check(message.status === 200, 'staging message send');
  const received = await api(1, `conversations/${conversation.id}/messages`);
  check(received.status === 200, 'recipient message read');
  checks.two_account_connections_and_messaging = true;
  phase = 'Auth recovery';
  const banned = await admin.auth.admin.updateUserById(ids[1], { ban_duration: '1h' });
  check(!banned.error, 'fixture temporary Auth ban');
  const isolated = createClient(url, publicConfig.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  check(
    Boolean(
      (await isolated.auth.signInWithPassword({ email: emails[1], password: passwords[1] })).error,
    ),
    'banned fixture login rejected',
  );
  check(
    !(await admin.auth.admin.updateUserById(ids[1], { ban_duration: 'none' })).error,
    'fixture Auth configuration recovery',
  );
  const restored = await isolated.auth.signInWithPassword({
    email: emails[1],
    password: passwords[1],
  });
  check(!restored.error && restored.data.user?.id === ids[1], 'same fixture login after recovery');
  checks.synthetic_auth_recovery = true;
  const link = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: emails[1],
    options: { redirectTo: 'http://localhost:3001/reset-password' },
  });
  check(!link.error && link.data.properties, 'fixture recovery link generation');
  const redirect = await fetch(link.data.properties!.action_link, { redirect: 'manual' });
  const location = redirect.headers.get('location');
  check(location, 'Auth recovery redirect');
  const destination = new URL(location!);
  check(
    destination.origin === 'http://localhost:3001' && destination.pathname === '/reset-password',
    'exact staging recovery redirect',
  );
  checks.recovery_redirect_configuration = true;
  successful = true;
} catch (error) {
  console.error(
    `Singapore synthetic rehearsal failed in phase: ${phase}; check: ${failedCheck}. No secret, token or provider detail is reported.`,
  );
  process.exitCode = 1;
} finally {
  let cleanup = true;
  for (const client of clients)
    await client.auth.signOut().catch(() => {
      cleanup = false;
    });
  for (const file of files) {
    const result = await admin.storage.from(file.bucket).remove([file.path]);
    if (result.error) cleanup = false;
  }
  if (ids.length) {
    await db.moderationAction.deleteMany({ where: { actorId: { in: ids } } });
    await db.event.deleteMany({ where: { ownerId: { in: ids } } });
    await db.conversation.deleteMany({ where: { id: { in: fixtureTargets } } });
    await db.recommendationJob.deleteMany({
      where: { targetId: { in: [...ids, ...fixtureTargets] } },
    });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    for (const id of ids) {
      const result = await admin.auth.admin.deleteUser(id);
      if (result.error) cleanup = false;
    }
  }
  const after = await db.$queryRaw<
    typeof baseline
  >`SELECT (SELECT count(*) FROM public."User") AS users,
    (SELECT count(*) FROM public."User" WHERE "collegeVerified") AS verified,
    (SELECT count(*) FROM auth.users) AS auth_users,(SELECT count(*) FROM storage.objects) AS objects`;
  const unchanged = Object.keys(baseline[0]).every(
    (key) =>
      baseline[0][key as keyof (typeof baseline)[0]] === after[0][key as keyof (typeof after)[0]],
  );
  const report = {
    observed_at: new Date().toISOString(),
    destination_project: ref,
    historical_storage_waived: true,
    historical_storage_operations: 0,
    synthetic_accounts_created: ids.length,
    checks,
    successful,
    cleanup_passed: cleanup && unchanged,
    historical_verification_count_preserved: baseline[0].verified === after[0].verified,
    full_service_disaster_recovery: 'not verified',
    production_cutover: false,
  };
  await writeFile(
    'docs/supabase-new-storage-evidence.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report, null, 2));
  if (!cleanup || !unchanged) process.exitCode = 1;
  await db.$disconnect();
}
