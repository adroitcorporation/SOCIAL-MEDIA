// Keep ranking policy in one place. Scores describe fit, not calibrated probabilities.
export const ranking = {
  weights: { intent: 30, reciprocal: 25, complement: 15, interests: 15, collaboration: 5, semantic: 8, freshness: 2 },
  profilePageSize: 12,
  teamCandidates: 80,
  maximumReasons: 3,
  feedbackLimit: 4,
  feedbackDays: 30,
  retentionDays: 90,
  embeddingDimensions: 384,
  providerTimeoutMs: 8000,
  workerBatch: 5,
  maxAttempts: 4,
  leaseSeconds: 180,
};
export const recommendationsEnabled = () => process.env.RECOMMENDATIONS_ENABLED !== 'false';
