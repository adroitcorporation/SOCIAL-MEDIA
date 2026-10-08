import 'server-only';
import { migrationMaintenance } from '@/backend/utils/maintenance';
import { createHash, randomUUID } from 'node:crypto';
import { db } from '@/backend/database/client';
import { normalizeList } from '@/shared/recommendations/taxonomy';
import {
  getProvider,
  inferenceSchema,
  localInference,
  scrubPublicText,
  validateEmbedding,
  type AIProvider,
} from './provider';
import { ranking } from './config';

type Job = { kind: string; targetId: string; version: number; attempts: number; lockToken: string };
async function source(job: Job) {
  if (job.kind === 'POST') {
    const post = await db.post.findFirst({
      where: {
        id: job.targetId,
        visibility: 'PUBLIC',
        author: { accountStatus: 'ACTIVE', onboarded: true },
      },
      select: { content: true },
    });
    return post
      ? { text: scrubPublicText(JSON.stringify(post)), skills: [], interests: [], lookingFor: [] }
      : null;
  }
  if (job.kind === 'PROFILE') {
    const p = await db.user.findUnique({
      where: { id: job.targetId },
      select: { bio: true, skills: true, interests: true, lookingFor: true, domains: true },
    });
    return p
      ? {
          text: scrubPublicText(JSON.stringify(p)),
          skills: normalizeList('skills', p.skills),
          interests: normalizeList('interests', p.interests),
          lookingFor: normalizeList('lookingFor', p.lookingFor),
        }
      : null;
  }
  if (job.kind === 'IDEA') {
    const p = await db.idea.findUnique({
      where: { id: job.targetId },
      select: { title: true, description: true, skills: true, tags: true, category: true },
    });
    return p
      ? {
          text: scrubPublicText(JSON.stringify(p)),
          skills: normalizeList('skills', p.skills),
          interests: normalizeList('interests', [p.category, ...p.tags]),
          lookingFor: [],
        }
      : null;
  }
  const p = await db.event.findUnique({
    where: { id: job.targetId },
    select: { title: true, description: true, category: true },
  });
  return p
    ? {
        text: scrubPublicText(JSON.stringify(p)),
        skills: [],
        interests: normalizeList('interests', [p.category]),
        lookingFor: [],
      }
    : null;
}
export async function processRecommendationJobs(
  limit = ranking.workerBatch,
  provider: AIProvider = getProvider(),
) {
  if (migrationMaintenance()) return 0;
  let processed = 0;
  for (let i = 0; i < Math.min(100, Math.max(0, limit)); i++) {
    const token = randomUUID();
    const [job] = await db.$queryRaw<Job[]>`
      UPDATE "RecommendationJob" j SET "lockedUntil"=CURRENT_TIMESTAMP+${ranking.leaseSeconds}*interval '1 second',"lockToken"=${token},attempts=attempts+1
      WHERE (j.kind,j."targetId") IN (SELECT kind,"targetId" FROM "RecommendationJob" WHERE "availableAt"<=CURRENT_TIMESTAMP AND ("lockedUntil" IS NULL OR "lockedUntil"<CURRENT_TIMESTAMP) AND attempts<${ranking.maxAttempts} ORDER BY "availableAt",kind,"targetId" FOR UPDATE SKIP LOCKED LIMIT 1)
      RETURNING j.*`;
    if (!job) break;
    const data = await source(job);
    if (!data) {
      await db.recommendationJob.deleteMany({ where: { lockToken: token } });
      continue;
    }
    const sourceHash = createHash('sha256')
      .update(JSON.stringify([provider.extractionModel ?? 'local', data.text]))
      .digest('hex');
    const previous = await db.recommendationDocument.findUnique({
      where: { kind_targetId: { kind: job.kind, targetId: job.targetId } },
    });
    let inferred = localInference(data.text),
      embedding: number[] = [],
      failed = false;
    try {
      if (
        previous?.sourceHash === sourceHash &&
        previous.embeddingModel === provider.model &&
        (!provider.model || previous.embedding.length)
      ) {
        inferred = inferenceSchema.parse(previous.inferred);
        embedding = previous.embedding;
      } else {
        inferred = inferenceSchema.parse(
          await (job.kind === 'PROFILE'
            ? provider.extractStructuredProfile(data.text)
            : provider.classifyContent(data.text)),
        );
        const result = await provider.generateEmbedding(data.text);
        embedding = provider.model ? validateEmbedding(result) : [];
      }
    } catch {
      failed = true;
      console.warn(
        JSON.stringify({
          event: 'recommendation_enrichment_failed',
          kind: job.kind,
          attempt: job.attempts,
        }),
      );
    }
    // Lock the job again before committing so a concurrent profile edit cannot publish stale data.
    await db.$transaction(async (tx) => {
      const current = await tx.$queryRaw<
        Job[]
      >`SELECT * FROM "RecommendationJob" WHERE kind=${job.kind} AND "targetId"=${job.targetId} AND "lockToken"=${token} AND version=${job.version} FOR UPDATE`;
      if (!current.length) return;
      const record = {
        sourceHash,
        skills: data.skills,
        interests: data.interests,
        lookingFor: data.lookingFor,
        inferred,
        embedding,
        embeddingModel: embedding.length ? provider.model : '',
        updatedAt: new Date(),
      };
      await tx.recommendationDocument.upsert({
        where: { kind_targetId: { kind: job.kind, targetId: job.targetId } },
        create: { kind: job.kind, targetId: job.targetId, ...record },
        update: record,
      });
      if (failed)
        await tx.recommendationJob.update({
          where: { kind_targetId: { kind: job.kind, targetId: job.targetId } },
          data: {
            lockedUntil: null,
            lockToken: null,
            availableAt: new Date(Date.now() + 30_000 * 2 ** job.attempts),
            lastError: 'provider_unavailable',
          },
        });
      else await tx.recommendationJob.deleteMany({ where: { lockToken: token } });
    });
    processed++;
  }
  await db.recommendationInteraction.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - ranking.retentionDays * 86400000) } },
  });
  return processed;
}
let started = false;
export function startRecommendationWorker() {
  if (started) return;
  started = true;
  const tick = async () => {
    try {
      await processRecommendationJobs();
    } catch {
      console.warn(JSON.stringify({ event: 'recommendation_worker_failed' }));
    }
    setTimeout(() => void tick(), 15_000).unref();
  };
  void tick();
}
