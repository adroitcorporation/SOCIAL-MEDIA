import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, relative } from 'node:path';
import { z } from 'zod';
import { planPhotoUrls } from './lib/photo-url-plan';

const args = process.argv.slice(2);
if (
  args.length !== 6 ||
  args[0] !== '--profiles' ||
  args[2] !== '--manifest' ||
  args[4] !== '--output'
)
  throw new Error(
    'Offline only. Usage: --profiles <ignored JSON> --manifest <verified JSON> --output <new ignored JSON>',
  );
for (const file of [args[1], args[3], args[5]]) {
  const path = relative(resolve('.local'), resolve(file));
  if (!path || path.startsWith('..') || resolve(file) === resolve('.local'))
    throw new Error('Use files inside protected .local only');
  execFileSync('git', ['check-ignore', '--quiet', '--', file], { stdio: 'ignore' });
  if (execFileSync('git', ['ls-files', '--', file], { encoding: 'utf8' }).trim())
    throw new Error('Audit file must be untracked');
}
const profiles = z
  .array(z.object({ id: z.string().min(1), photo: z.string() }))
  .parse(JSON.parse(await readFile(args[1], 'utf8')));
const manifest = z
  .object({
    snapshot_synchronized: z.literal(true),
    verified: z.array(
      z.object({
        bucket: z.string(),
        path: z.string(),
        sha256: z.string(),
        source_destination_sha256_match: z.boolean(),
        public_head_status: z.number(),
      }),
    ),
  })
  .parse(JSON.parse(await readFile(args[3], 'utf8')));
const plan = planPhotoUrls(profiles, manifest.verified);
await writeFile(
  args[5],
  JSON.stringify({ ...plan, prepared_at: new Date().toISOString(), cloud_writes: 0 }, null, 2) +
    '\n',
  { flag: 'wx', mode: 0o600 },
);
console.log(
  JSON.stringify({
    mode: plan.mode,
    changes: plan.changes.length,
    unresolved: plan.unresolved.length,
    cloud_writes: 0,
  }),
);
