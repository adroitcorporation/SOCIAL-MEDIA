// Offline planner: never invokes gcloud, changes credentials, or executes commands.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { GCP_PRIMARY_REGION } from '../src/shared/config/gcp-environment.mjs';

export function stagingPlan(config) {
  const allowed = ['projectId', 'authProjectId', 'billingAccountId', 'projectNumber', 'region'];
  if (Object.keys(config).some((key) => !allowed.includes(key)))
    throw new Error('Only nonsecret staging identifiers are accepted.');
  const {
    projectId,
    authProjectId = 'cynk-staging-e9c53',
    billingAccountId = 'BILLING_ACCOUNT_ID',
    projectNumber = 'PROJECT_NUMBER',
  } = config;
  if (!/^cynk-staging(?:-[a-z0-9]{1,12})?$/.test(projectId || ''))
    throw new Error('A dedicated cynk-staging project ID is required.');
  if (!/^cynk-staging(?:-[a-z0-9]{1,12})?$/.test(authProjectId || ''))
    throw new Error('A dedicated staging Firebase project ID is required.');
  if (config.region && config.region !== GCP_PRIMARY_REGION)
    throw new Error('Staging region must be Delhi NCR.');
  if (!/^(?:BILLING_ACCOUNT_ID|[A-F0-9]{6}-[A-F0-9]{6}-[A-F0-9]{6})$/.test(billingAccountId))
    throw new Error('Invalid billing account ID.');
  if (!/^(?:PROJECT_NUMBER|[0-9]{6,})$/.test(projectNumber))
    throw new Error('Invalid project number.');
  const region = GCP_PRIMARY_REGION;
  const projectFlag = '--project=' + projectId;
  const sa = (name) => name + '@' + projectId + '.iam.gserviceaccount.com';
  const cmd = (...args) => ['gcloud', ...args, projectFlag];
  const authCmd = (...args) => ['gcloud', ...args, '--project=' + authProjectId];
  const bind = (name, role) =>
    cmd(
      'projects',
      'add-iam-policy-binding',
      projectId,
      '--member=serviceAccount:' + sa(name),
      '--role=' + role,
      '--condition=None',
    );
  const buckets = ['profile-photos', 'college-ids', 'event-attachments', 'build-source'].map(
    (name) => projectId + '-staging-' + name,
  );
  const preflight = [
    cmd('projects', 'describe', projectId, '--format=json(projectId,projectNumber,lifecycleState)'),
    cmd(
      'billing',
      'projects',
      'describe',
      projectId,
      '--format=json(projectId,billingAccountName,billingEnabled)',
    ),
    cmd('services', 'list', '--enabled', '--format=value(config.name)'),
    cmd('sql', 'instances', 'list', '--format=json(name,region,databaseVersion)'),
    cmd('run', 'services', 'list', '--region=' + region, '--format=json(metadata.name,status.url)'),
    cmd('storage', 'buckets', 'list', '--format=json(name,location,iamConfiguration)'),
    cmd('artifacts', 'repositories', 'list', '--location=' + region, '--format=json(name,format)'),
    cmd('iam', 'service-accounts', 'list', '--format=value(email)'),
    cmd('secrets', 'list', '--format=value(name)'),
    cmd('quotas', 'info', 'list', '--service=run.googleapis.com', '--format=json'),
    cmd('quotas', 'info', 'list', '--service=sqladmin.googleapis.com', '--format=json'),
  ];
  const provision = [
    // API enablement is completed; provisioning never enables additional APIs.
    cmd(
      'artifacts',
      'repositories',
      'create',
      'cynk',
      '--repository-format=docker',
      '--location=' + region,
    ),
    ...['cynk-runtime', 'cynk-migrator', 'cynk-build', 'cynk-recommendations'].map((name) =>
      cmd('iam', 'service-accounts', 'create', name, '--display-name=' + name),
    ),
    ...buckets.map((name) =>
      cmd(
        'storage',
        'buckets',
        'create',
        'gs://' + name,
        '--location=' + region,
        '--default-storage-class=STANDARD',
        '--uniform-bucket-level-access',
        '--public-access-prevention',
      ),
    ),
    ...['cynk-runtime-database-url', 'cynk-migration-database-url'].map((name) =>
      cmd('secrets', 'create', name, '--replication-policy=user-managed', '--locations=' + region),
    ),
    cmd(
      'sql',
      'instances',
      'create',
      'cynk-staging-db',
      '--edition=ENTERPRISE',
      '--database-version=POSTGRES_16',
      '--tier=db-f1-micro',
      '--region=' + region,
      '--availability-type=ZONAL',
      '--storage-type=SSD',
      '--storage-size=10',
      '--no-storage-auto-increase',
      '--backup-start-time=20:00',
      '--backup-location=' + region,
      '--retained-backups-count=7',
      '--enable-point-in-time-recovery',
      '--retained-transaction-log-days=7',
      '--deletion-protection',
      '--assign-ip',
    ),
    cmd('sql', 'databases', 'create', 'cynk_staging', '--instance=cynk-staging-db'),
    authCmd(
      'iam',
      'roles',
      'create',
      'cynkIdentityReader',
      '--title=CYNKIdentityReader',
      '--permissions=firebaseauth.users.get',
      '--stage=GA',
    ),
    cmd(
      'iam',
      'roles',
      'create',
      'cynkFileAccess',
      '--title=CYNKFileAccess',
      '--permissions=storage.objects.get,storage.objects.create,storage.objects.delete',
      '--stage=GA',
    ),
    bind('cynk-runtime', 'roles/cloudsql.client'),
    bind('cynk-migrator', 'roles/cloudsql.client'),
    bind('cynk-recommendations', 'roles/cloudsql.client'),
    authCmd(
      'projects',
      'add-iam-policy-binding',
      authProjectId,
      '--member=serviceAccount:' + sa('cynk-runtime'),
      '--role=projects/' + authProjectId + '/roles/cynkIdentityReader',
      '--condition=None',
    ),
    bind('cynk-build', 'roles/logging.logWriter'),
    ...buckets
      .slice(0, 3)
      .map((name) =>
        cmd(
          'storage',
          'buckets',
          'add-iam-policy-binding',
          'gs://' + name,
          '--member=serviceAccount:' + sa('cynk-runtime'),
          '--role=projects/' + projectId + '/roles/cynkFileAccess',
        ),
      ),
    cmd(
      'storage',
      'buckets',
      'add-iam-policy-binding',
      'gs://' + buckets[3],
      '--member=serviceAccount:' + sa('cynk-build'),
      '--role=roles/storage.objectViewer',
    ),
    cmd(
      'artifacts',
      'repositories',
      'add-iam-policy-binding',
      'cynk',
      '--location=' + region,
      '--member=serviceAccount:' + sa('cynk-build'),
      '--role=roles/artifactregistry.writer',
    ),
    ...[
      ['cynk-runtime-database-url', 'cynk-runtime'],
      ['cynk-migration-database-url', 'cynk-migrator'],
      ['cynk-runtime-database-url', 'cynk-recommendations'],
    ].map(([secret, account]) =>
      cmd(
        'secrets',
        'add-iam-policy-binding',
        secret,
        '--member=serviceAccount:' + sa(account),
        '--role=roles/secretmanager.secretAccessor',
      ),
    ),
  ];
  const budget = [
    [
      'gcloud',
      'billing',
      'budgets',
      'create',
      '--billing-account=' + billingAccountId,
      '--display-name=CYNK-staging-gross-INR-1694',
      '--budget-amount=1694INR',
      '--filter-projects=projects/' + projectNumber,
      '--calendar-period=month',
      '--credit-types-treatment=exclude-all-credits',
      ...[0.5, 0.75, 0.9, 1].map(
        (percent) => '--threshold-rule=percent=' + percent + ',basis=current-spend',
      ),
      '--threshold-rule=percent=0.9,basis=forecasted-spend',
      '--threshold-rule=percent=1,basis=forecasted-spend',
    ],
  ];
  // Deletions are a review list, NOT an executable cleanup mode. No bucket contents are removed.
  const cleanup = [
    cmd('run', 'services', 'delete', 'cynk-staging-backend', '--region=' + region),
    cmd('run', 'jobs', 'delete', 'cynk-staging-migrate', '--region=' + region),
    cmd('run', 'jobs', 'delete', 'cynk-staging-recommendations', '--region=' + region),
    ...buckets.map((name) => cmd('storage', 'rm', 'gs://' + name)),
    cmd('artifacts', 'repositories', 'delete', 'cynk', '--location=' + region),
    ...['cynk-runtime-database-url', 'cynk-migration-database-url'].map((name) =>
      cmd('secrets', 'delete', name),
    ),
    // Remove the cross-project grant while the service-account principal still exists.
    authCmd(
      'projects',
      'remove-iam-policy-binding',
      authProjectId,
      '--member=serviceAccount:' + sa('cynk-runtime'),
      '--role=projects/' + authProjectId + '/roles/cynkIdentityReader',
      '--condition=None',
    ),
    ...['cynk-runtime', 'cynk-migrator', 'cynk-build', 'cynk-recommendations'].map((name) =>
      cmd('iam', 'service-accounts', 'delete', sa(name)),
    ),
    cmd('iam', 'roles', 'delete', 'cynkFileAccess'),
    authCmd('iam', 'roles', 'delete', 'cynkIdentityReader'),
    // This fails while deletion protection is enabled. Removing protection requires its own approved manual review.
    cmd('sql', 'instances', 'delete', 'cynk-staging-db'),
  ];
  const plan = {
    projectId,
    authProjectId,
    region,
    budgetINR: 2000,
    budgetUsageINR: 1694,
    architecture: 'single-cloud-run-nextjs-frontend-and-node-api',
    mode: 'OFFLINE_REVIEW_ONLY',
    gates: [
      'Confirm dedicated empty project and billing currency INR.',
      'Confirm trial balance, expiry, org policy, quotas and regional Console quote.',
      'Explicit provisioning/IAM approval; existing resources require a revised plan.',
      'Separate credential/Auth setup approval. No keys or passwords in this plan.',
      'Separate build/migration/deployment approval; use guide for public config.',
      'Separate cleanup approval and verified recovery/retention review.',
    ],
    preflight,
    provision,
    budget,
    cleanup,
  };
  return { ...plan, sha256: createHash('sha256').update(JSON.stringify(plan)).digest('hex') };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3)
      throw new Error(
        'Usage: node scripts/gcp-staging-plan.mjs NONSECRET_CONFIG.json (offline only)',
      );
    console.log(
      JSON.stringify(stagingPlan(JSON.parse(readFileSync(process.argv[2], 'utf8'))), null, 2),
    );
  } catch (error) {
    // Parsing errors may include input contents; never print the supplied file or raw JSON error.
    console.error(
      error instanceof SyntaxError ? 'Invalid nonsecret configuration JSON.' : error.message,
    );
    process.exitCode = 1;
  }
}
