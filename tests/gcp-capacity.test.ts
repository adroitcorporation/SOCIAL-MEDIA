import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
describe('Temporary Cloud Build capacity preflight boundaries', () => {
  it('has a bounded manual build without registry publishing or deployment steps', () => {
    const build = parse(read('deployment/gcp/cloudbuild.capacity.yaml'));
    expect(build.timeout).toBe('1800s');
    expect(build.options.logging).toBe('CLOUD_LOGGING_ONLY');
    expect(build.images).toBeUndefined();
    expect(build.steps).toEqual([
      {
        name: 'gcr.io/cloud-builders/docker',
        entrypoint: 'bash',
        args: ['scripts/gcp-capacity-preflight.sh'],
      },
    ]);
  });
  it('constrains the app with one CPU, memory and no swap and retains strict startup guards', () => {
    const shell = read('scripts/gcp-capacity-preflight.sh');
    expect(shell).toContain('--cpus=1 --memory="${memory}m" --memory-swap="${memory}m"');
    expect(shell).toContain('for memory in 512 1024 2048');
    expect(shell).toContain('LOCAL_DEMO=false');
    expect(shell).toContain('synthetic-capacity-public-key');
    expect(shell).not.toMatch(/gcloud|docker push|roles\/owner/);
    expect(shell).toContain('/var/run/postgresql,$socket');
    expect(shell).toContain('trap cleanup EXIT');
    expect(read('deployment/gcp/Dockerfile')).toContain('FROM runtime AS capacity');
  });
  it('does not substitute anonymous workloads for positive authentication evidence', () => {
    const helper = read('scripts/gcp-capacity-workload.cjs');
    expect(helper).toContain('CAPACITY_FIXTURE');
    expect(helper).toContain('memoryPeakBytes');
    expect(helper).toContain('No successful Firebase login');
    expect(helper).not.toContain('verifyIdToken =');
    expect(helper).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
