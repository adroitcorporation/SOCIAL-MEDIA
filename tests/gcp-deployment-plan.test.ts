import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { stagingPlan } from '../scripts/gcp-staging-plan.mjs';
import {
  monthlyEstimate,
  inrStagingEstimate,
  accountStagingEstimate,
} from '../scripts/gcp-costs.mjs';
import { GCP_PRIMARY_REGION } from '../src/shared/config/gcp-environment.mjs';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const plan = stagingPlan({ projectId: 'cynk-staging' });

describe('Offline Delhi staging plan safety', () => {
  it('includes account-quoted INR source storage, jobs, first-tier egress and tax', () => {
    const estimate = accountStagingEstimate();
    expect(estimate.basis).toContain('account-specific');
    expect(estimate.items.sqlCompute).toBeCloseTo(882.90452);
    expect(estimate.items.egress).toBeCloseTo(57.59325);
    expect(estimate.items.gcs).toBeCloseTo(4.41548);
    expect(estimate.items.jobs).toBeGreaterThan(0);
    expect(estimate.pretaxINR).toBeCloseTo(1512.22971);
    expect(estimate.taxReserveINR).toBeCloseTo(272.20135);
    expect(estimate.includingTaxINR).toBeCloseTo(1784.43105);
    expect(estimate.withinApprovedBudget).toBe(true);
    expect(estimate.assumptions).toContain('Not a hard spending cap');
  });
  it.each([
    { projectId: 'cynk-production' },
    { projectId: 'another-project' },
    { projectId: 'cynk-staging;echo' },
    { projectId: 'cynk-staging', region: 'asia-south1' },
    { projectId: 'cynk-staging', secret: 'must-not-be-accepted' },
    { projectId: 'cynk-staging', billingAccountId: 'invalid' },
  ])('rejects non-staging, wrong-region and credential input %#', (config) => {
    expect(() => stagingPlan(config)).toThrow();
  });
  it('does not execute commands or change authentication in any mode', () => {
    expect(read('scripts/gcp-staging-plan.mjs')).not.toMatch(
      /child_process|execSync|spawnSync|execFile/,
    );
    const commands = [...plan.preflight, ...plan.provision, ...plan.budget, ...plan.cleanup];
    expect(commands.flat().join(' ')).not.toMatch(
      /auth login|config set|service-accounts keys|versions add|--password|--quiet|--recursive/,
    );
    expect(plan.mode).toBe('OFFLINE_REVIEW_ONLY');
    expect(plan.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(stagingPlan({ projectId: 'cynk-staging' }).sha256).toBe(plan.sha256);
  });
  it('pins resources, private buckets, deletion protection and INR budget', () => {
    expect(plan.region).toBe(GCP_PRIMARY_REGION);
    expect(plan.budgetINR).toBe(2000);
    expect(plan.provision.flat()).toContain('--deletion-protection');
    const buckets = plan.provision.filter(
      (cmd: string[]) => cmd.slice(1, 4).join(' ') === 'storage buckets create',
    );
    expect(buckets).toHaveLength(4);
    for (const cmd of buckets) {
      expect(cmd).toContain('--public-access-prevention');
      expect(cmd).toContain('--uniform-bucket-level-access');
      expect(cmd).toContain('--location=asia-south2');
    }
    expect(plan.budget[0]).toContain('--credit-types-treatment=exclude-all-credits');
    expect(plan.budget[0]).toContain('--budget-amount=1694INR');
    expect(plan.provision.flat().join(' ')).not.toMatch(
      /roles\/(owner|editor|storage.admin|firebaseauth.admin)/,
    );
  });
  it('grants Auth read access in the separate Firebase project only', () => {
    expect(plan.authProjectId).toBe('cynk-staging-e9c53');
    const authCommands = plan.provision.filter((cmd: string[]) =>
      cmd.includes('--project=cynk-staging-e9c53'),
    );
    expect(authCommands).toHaveLength(2);
    expect(authCommands.flat()).toContain('--permissions=firebaseauth.users.get');
    expect(authCommands.flat()).toContain(
      '--member=serviceAccount:cynk-runtime@cynk-staging.iam.gserviceaccount.com',
    );
    expect(authCommands.flat()).toContain(
      '--role=projects/cynk-staging-e9c53/roles/cynkIdentityReader',
    );
    expect(plan.provision.flat()).not.toContain(
      '--role=projects/cynk-staging/roles/cynkIdentityReader',
    );
  });
  it('keeps every existing Prisma migration unchanged in number', () => {
    const migrations = readdirSync(new URL('src/backend/database/prisma/migrations/', root), {
      withFileTypes: true,
    });
    expect(migrations.filter((entry) => entry.isDirectory())).toHaveLength(15);
  });
});

describe('Regional templates and estimates', () => {
  it('includes frontend traffic in the combined Cloud Run estimate and prevents automatic disk growth', () => {
    const estimate = monthlyEstimate('asia-south2', false, { fullStack: true });
    expect(estimate.assumptions.activeInstanceHours).toBe(20);
    expect(estimate.assumptions.egressGiB).toBe(5);
    expect(estimate.items.requests).toBeCloseTo(0.04);
    expect(inrStagingEstimate({ fullStack: true }).includingTaxINR).toBeCloseTo(1851.4436);
    expect(plan.provision.flat()).toContain('--no-storage-auto-increase');
    expect(plan.architecture).toBe('single-cloud-run-nextjs-frontend-and-node-api');
  });
  it('labels INR as an assumption, includes GST, and rejects invalid conversions', () => {
    const estimate = inrStagingEstimate();
    expect(estimate.basis).toContain('NOT verified account INR SKU');
    expect(estimate.pretaxINR).toBeCloseTo(1403.76);
    expect(estimate.includingTaxINR).toBeCloseTo(1656.4368);
    expect(() => inrStagingEstimate({ inrPerUsd: -1 })).toThrow();
    expect(() => inrStagingEstimate({ gstRate: Number.NaN })).toThrow();
    expect(
      plan.provision.some((cmd: string[]) => cmd.slice(1, 3).join(' ') === 'services enable'),
    ).toBe(false);
    expect(plan.budget[0]).toContain('--display-name=CYNK-staging-gross-INR-1694');
    expect(plan.provision.flat()).toContain(
      '--member=serviceAccount:cynk-recommendations@cynk-staging.iam.gserviceaccount.com',
    );
  });
  it('has no Mumbai defaults in active deployment templates', () => {
    for (const path of [
      'deployment/gcp/service.yaml',
      'deployment/gcp/cloudbuild.yaml',
      'deployment/gcp/backend.env.example',
      'deployment/gcp/backend.env.yaml.example',
      'deployment/gcp/frontend.env.example',
      'deployment/gcp/Dockerfile',
      'scripts/gcp-staging-plan.mjs',
      'src/shared/config/gcp-environment.mjs',
    ])
      expect(read(path), path).not.toContain('asia-south1');
  });
  it('includes every public backend env variable in the service and YAML env file', () => {
    const keys = read('deployment/gcp/backend.env.example')
      .split(/\r?\n/)
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => line.split('=')[0]);
    const service = parse(read('deployment/gcp/service.yaml'));
    const env = service.spec.template.spec.containers[0].env;
    const file = parse(read('deployment/gcp/backend.env.yaml.example'));
    expect(Object.keys(file).sort()).toEqual(keys.sort());
    expect(
      env
        .filter((item: { name: string }) => item.name !== 'DATABASE_URL')
        .map((item: { name: string }) => item.name)
        .sort(),
    ).toEqual(keys.sort());
    expect(
      env.find((item: { name: string }) => item.name === 'DATABASE_URL').valueFrom.secretKeyRef,
    ).toEqual({ name: 'cynk-runtime-database-url', key: '1' });
    expect(service.spec.template.spec.containerConcurrency).toBe(20);
    expect(
      service.spec.template.metadata.annotations['run.googleapis.com/cloudsql-instances'],
    ).toBe(`PROJECT_ID:${GCP_PRIMARY_REGION}:cynk-staging-db`);
    expect(
      env.find((item: { name: string }) => item.name === 'CLOUD_SQL_CONNECTION_NAME').value,
    ).toBe(service.spec.template.metadata.annotations['run.googleapis.com/cloudsql-instances']);
    const build = parse(read('deployment/gcp/cloudbuild.yaml'));
    for (const image of build.images)
      expect(image).toMatch(new RegExp(`^${GCP_PRIMARY_REGION}-docker\\.pkg\\.dev/`));
    expect(service.spec.template.metadata.annotations['run.googleapis.com/cpu-throttling']).toBe(
      'true',
    );
  });
  it('uses actual Tier 2 pricing and Tier 1 dollar credits rather than equal free seconds', () => {
    const delhi = monthlyEstimate('asia-south2', true);
    const mumbai = monthlyEstimate('asia-south1', true);
    expect(delhi.items.sqlCompute).toBeCloseTo(mumbai.items.sqlCompute);
    expect(delhi.items.run / mumbai.items.run).toBeCloseTo(1.4);
    expect(delhi.grossUSD).toBeCloseTo(85.583, 2);
    expect(delhi.withUnusedFreeAllowancesUSD).toBeCloseTo(78.19, 2);
    expect(monthlyEstimate('asia-south2').grossUSD).toBeCloseTo(14.0376, 3);
    expect(() => monthlyEstimate('unknown')).toThrow();
  });
});
