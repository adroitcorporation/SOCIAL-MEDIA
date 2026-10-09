import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const pricing = JSON.parse(
  readFileSync(new URL('../deployment/gcp/pricing.usd.json', import.meta.url), 'utf8'),
);

// Authenticated INR quote, independent of the earlier USD/FX planning allowance.
export function accountStagingEstimate() {
  const quote = JSON.parse(
    readFileSync(new URL('../deployment/gcp/pricing.inr.json', import.meta.url), 'utf8'),
  );
  const rate = (sku) => {
    const entry = quote.rates.find((item) => item.skuId === sku);
    if (!entry || entry.currency !== 'INR' || !Number.isFinite(entry.grossRate))
      throw new Error(`Missing verified INR quote: ${sku}`);
    return entry.grossRate / entry.unitQuantity;
  };
  const items = {
    sqlCompute: 730 * rate('373F-9187-D22A'),
    sqlSsd: 10 * rate('B393-A1A5-83CA'),
    sqlBackupUsed: 2 * rate('2A6D-A928-ED0A'),
    run: 72000 * (rate('085C-A237-027A') + 0.5 * rate('600C-3782-6708')),
    requests: 100000 * rate('2DA5-55D3-E679'),
    // One GiB files plus one GiB source archives across the four private buckets.
    gcs: 2 * rate('B219-7161-A1AF'),
    gcsOperations: 1000 * rate('4DBF-185F-A415') + 10000 * rate('7870-010B-2763'),
    artifacts: 2 * rate('8502-299A-ABAF'),
    secretVersions: 2 * rate('7756-ADEF-84F4'),
    secretAccess: 1000 * rate('EBA7-264F-2D2C'),
    build: 120 * rate('A464-9020-6404'),
    egress: 5 * rate('9EA6-AE6D-E34E'),
    jobs: 1800 * (rate('B0A0-113A-7C65') + 0.5 * rate('F3F4-685E-66FF')),
    logging: 0,
    basicAuth: 0,
  };
  const pretaxINR = Object.values(items).reduce((sum, value) => sum + value, 0);
  const taxReserveINR = pretaxINR * 0.18;
  return {
    verifiedAt: quote.verifiedAt,
    basis: quote.source,
    items,
    pretaxINR,
    taxReserveINR,
    includingTaxINR: pretaxINR + taxReserveINR,
    withinApprovedBudget: pretaxINR + taxReserveINR <= 2000,
    assumptions:
      '20 aggregate Run hours; 30 aggregate job minutes; 2 GiB retained backups; ' +
      '2 GiB GCS including source/soft-deleted objects; 2 GiB registry; 120 build minutes; ' +
      '5 GiB Asia-Pacific egress; 2 GiB logs within the project allowance; Spark Auth quotas. ' +
      'Not a hard spending cap or a deployed usage measurement.',
  };
}

// Usage assumptions, not performance measurements or spending limits.
export function monthlyEstimate(region, production = false, { fullStack = false } = {}) {
  const r = pricing.regions[region];
  if (!r) throw new Error('Unsupported pricing region.');
  const c = pricing.common;
  const seconds = (production ? 120 : fullStack ? 20 : 10) * 3600;
  const memory = production ? 1 : 0.5;
  const items = {
    sqlCompute: production
      ? (r.sqlEnterpriseCustomVcpuHour + 3.75 * r.sqlEnterpriseCustomMemoryGiBHour) * 730
      : r.sqlMicroHour * 730,
    sqlSsd: (production ? 20 : 10) * r.sqlSsdGiBMonth,
    sqlBackupUsed: (production ? 10 : 2) * r.sqlBackupUsedGiBMonth,
    run: seconds * (r.runActiveCpuSecond + memory * r.runActiveMemoryGiBSecond),
    requests: (production ? 0.5 : fullStack ? 0.1 : 0.05) * c.requestsMillion,
    gcs: (production ? 10 : 1) * r.gcsStandardGiBMonth,
    gcsOperations:
      (production ? 10 : 1) * c.gcsClassAThousand + (production ? 100 : 10) * c.gcsClassBThousand,
    artifacts: (production ? 5 : 2) * c.artifactGiBMonth,
    secretVersions: 2 * c.secretActiveVersionLocationMonth,
    secretAccess: 0.1 * c.secretAccessTenThousand,
    build: (production ? 300 : 120) * c.buildE2Standard2Minute,
    egress: (production ? 20 : fullStack ? 5 : 2) * c.internetEgressGiBFirstTierCommonDestinations,
    logging: 0,
    basicAuth: 0,
  };
  const gross = Object.values(items).reduce((a, b) => a + b, 0);
  const free = pricing.freeAllowances;
  const eligibleDiscount =
    Math.min(seconds * r.runActiveCpuSecond, free.runRequestCpuCreditUSD) +
    Math.min(seconds * memory * r.runActiveMemoryGiBSecond, free.runRequestMemoryCreditUSD) +
    items.requests +
    Math.min(items.artifacts, 0.5 * c.artifactGiBMonth) +
    items.secretVersions +
    items.secretAccess +
    items.build;
  return {
    region,
    scenario: production
      ? 'small-production-single-zone'
      : fullStack
        ? 'full-stack-staging'
        : 'minimum-staging',
    items,
    grossUSD: gross,
    withUnusedFreeAllowancesUSD: gross - eligibleDiscount,
    assumptions: {
      activeInstanceHours: seconds / 3600,
      minInstances: 0,
      cpu: 1,
      memoryGiB: memory,
      logsGiB: production ? 10 : 2,
      egressGiB: production ? 20 : fullStack ? 5 : 2,
    },
  };
}
export function inrStagingEstimate({ inrPerUsd = 100, gstRate = 0.18, fullStack = false } = {}) {
  if (
    !Number.isFinite(inrPerUsd) ||
    inrPerUsd <= 0 ||
    !Number.isFinite(gstRate) ||
    gstRate < 0 ||
    gstRate > 1
  )
    throw new Error('Invalid planning conversion/tax assumption.');
  const estimate = monthlyEstimate('asia-south2', false, { fullStack });
  const itemsINR = Object.fromEntries(
    Object.entries(estimate.items).map(([key, value]) => [key, value * inrPerUsd]),
  );
  const pretaxINR = estimate.grossUSD * inrPerUsd;
  return {
    basis:
      'Planning conversion assumption, NOT verified account INR SKU prices or a live FX quote.',
    inrPerUsd,
    gstRate,
    itemsINR,
    pretaxINR,
    gstINR: pretaxINR * gstRate,
    includingTaxINR: pretaxINR * (1 + gstRate),
    withUnusedFreeAllowancesIncludingTaxINR:
      estimate.withUnusedFreeAllowancesUSD * inrPerUsd * (1 + gstRate),
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(
    JSON.stringify(
      ['asia-south2', 'asia-south1'].flatMap((region) => [
        monthlyEstimate(region),
        monthlyEstimate(region, true),
      ]),
      null,
      2,
    ),
  );
