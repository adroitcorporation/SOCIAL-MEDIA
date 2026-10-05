import { processRecommendationJobs } from '../src/backend/recommendations/worker';
import { db } from '../src/backend/database/client';
import { ranking } from '../src/backend/recommendations/config';

try {
  if (process.argv.includes('--retry-failed')) {
    await db.recommendationJob.updateMany({
      where: { attempts: { gte: ranking.maxAttempts } },
      data: {
        attempts: 0,
        availableAt: new Date(),
        lockedUntil: null,
        lockToken: null,
        lastError: null,
      },
    });
  }
  if (process.argv.includes('--requeue')) {
    await db.$executeRaw`INSERT INTO "RecommendationJob"(kind,"targetId")
      SELECT 'PROFILE',id FROM "User" UNION ALL SELECT 'IDEA',id FROM "Idea" UNION ALL SELECT 'EVENT',id FROM "Event"
      ON CONFLICT(kind,"targetId") DO UPDATE SET version="RecommendationJob".version+1,attempts=0,"availableAt"=CURRENT_TIMESTAMP,"lockedUntil"=NULL,"lockToken"=NULL,"lastError"=NULL`;
  }
  const count = await processRecommendationJobs(process.argv.includes('--once') ? 5 : 100);
  console.info(`Processed ${count} recommendation jobs.`);
} finally {
  await db.$disconnect();
}
