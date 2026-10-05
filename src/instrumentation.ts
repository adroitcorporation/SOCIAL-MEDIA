export async function register() {
  if (
    process.env.NEXT_RUNTIME === 'nodejs' &&
    process.env.RECOMMENDATION_WORKER_ENABLED === 'true'
  ) {
    const { startRecommendationWorker } = await import('./backend/recommendations/worker');
    startRecommendationWorker();
  }
}
