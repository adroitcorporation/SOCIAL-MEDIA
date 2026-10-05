import { processRecommendationJobs } from '../src/backend/recommendations/worker';
import { db } from '../src/backend/database/client';

try {
  const count=await processRecommendationJobs(process.argv.includes('--once')?5:100);
  console.info(`Processed ${count} recommendation jobs.`);
} finally { await db.$disconnect(); }
