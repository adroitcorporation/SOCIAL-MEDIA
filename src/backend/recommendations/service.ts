import 'server-only';
import { Prisma, type User } from '@prisma/client';
import { z } from 'zod';
import { db } from '@/backend/database/client';
import { requireActiveActor } from '@/backend/services/permissions';
import { requireThat } from '@/backend/utils/errors';
import { visibleTo } from '@/backend/services/query-shapes';
import {
  normalizeList,
  normalizeValue,
  desiredSkills,
  complementarySkills,
} from '@/shared/recommendations/taxonomy';
import { teamRequestSchema } from '@/shared/contracts/recommendations';
import { ranking } from './config';
import { postSignalSql } from './post-signals';
import { balancedTeam, matchReasons, type Signals } from './scoring';

const array = (values: string[]) =>
  Prisma.sql`ARRAY[${Prisma.join(values.length ? values : [Prisma.sql`NULL`])}]::text[]`;
// Empty arrays must stay empty (not [NULL]), especially for cardinality-based denominators.
const arr = (values: string[]) => (values.length ? array(values) : Prisma.sql`'{}'::text[]`);
type Ranked = {
  postSignal: number;
  id: string;
  score: number;
  total: bigint;
  skills: string[];
  interests: string[];
  lookingFor: string[];
};
type Context = Signals & { requiredSkills?: string[]; documentKind?: string; documentId?: string };
export const recommendationPage = (query: URLSearchParams) =>
  z.coerce
    .number()
    .int()
    .min(0)
    .max(10000)
    .parse(query.get('page') || 0);
export async function rankedProfiles(
  user: User,
  query = new URLSearchParams(),
  context?: Context,
  limit = ranking.profilePageSize,
) {
  const start = Date.now();
  const a = context ?? user;
  const skills = normalizeList('skills', a.skills),
    interests = normalizeList('interests', a.interests),
    looking = normalizeList('lookingFor', a.lookingFor);
  const wanted = context?.requiredSkills ?? desiredSkills(looking),
    complement = complementarySkills(skills);
  const filters: Prisma.Sql[] = [];
  const search = query.get('search')?.slice(0, 100);
  if (search)
    filters.push(
      Prisma.sql`AND (strpos(lower(u.name||' '||u.college||' '||u.city||' '||u.bio),lower(${search}))>0 OR fc_college(u.college)=fc_college(${search}))`,
    );
  const college = query.get('college')?.slice(0, 150);
  if (college)
    filters.push(
      Prisma.sql`AND (fc_college(u.college)=fc_college(${college}) OR strpos(lower(u.college),lower(${college}))>0)`,
    );
  if (query.get('collegeScope') === 'mine')
    filters.push(Prisma.sql`AND fc_college(u.college)=fc_college(${user.college})`);
  if (query.get('collegeScope') === 'other')
    filters.push(Prisma.sql`AND fc_college(u.college)<>fc_college(${user.college})`);
  if (query.get('city'))
    filters.push(Prisma.sql`AND strpos(lower(u.city),lower(${query.get('city')!.slice(0, 80)}))>0`);
  if (query.get('state'))
    filters.push(
      Prisma.sql`AND EXISTS(SELECT 1 FROM "College" c WHERE c.id=fc_college(u.college) AND lower(c.state)=lower(${query.get('state')!.slice(0, 80)}))`,
    );
  if (query.get('graduationYear'))
    filters.push(
      Prisma.sql`AND u."graduationYear"=${z.coerce.number().int().min(2020).max(2040).parse(query.get('graduationYear'))}`,
    );
  for (const field of ['skills', 'interests', 'lookingFor'] as const) {
    if (query.get(field))
      filters.push(
        Prisma.sql`AND ${normalizeValue(field, query.get(field)!.slice(0, 50))}=ANY(fc_normalize(${field},${Prisma.raw(`u."${field}"`)}))`,
      );
  }
  if (query.get('domains'))
    filters.push(Prisma.sql`AND ${query.get('domains')!.slice(0, 50)}=ANY(u.domains)`);
  const w = ranking.weights;
  const rows = await db.$queryRaw<Ranked[]>(Prisma.sql`
    WITH candidates AS (
      SELECT u.id,u."updatedAt",d.inferred,${context ? Prisma.sql`0::float` : postSignalSql(user.id, skills, interests)} AS "postSignal",COALESCE(d.skills,fc_normalize('skills',u.skills)) skills,
        COALESCE(d.interests,fc_normalize('interests',u.interests)) interests,
        COALESCE(d."lookingFor",fc_normalize('lookingFor',u."lookingFor")) "lookingFor",
        CASE WHEN d."embeddingModel"<>'' AND d."embeddingModel"=own."embeddingModel" THEN GREATEST(0,fc_cosine(d.embedding,own.embedding)) ELSE 0 END semantic
      FROM "User" u
      LEFT JOIN "RecommendationDocument" d ON d.kind='PROFILE' AND d."targetId"=u.id
      LEFT JOIN "RecommendationDocument" own ON own.kind=${context?.documentKind ?? 'PROFILE'} AND own."targetId"=${context?.documentId ?? user.id}
      WHERE u.id<>${user.id} AND u."accountStatus"='ACTIVE' AND u.onboarded
      AND NOT EXISTS(SELECT 1 FROM "Block" b WHERE (b."blockerId"=${user.id} AND b."blockedId"=u.id) OR (b."blockedId"=${user.id} AND b."blockerId"=u.id))
      AND NOT EXISTS(SELECT 1 FROM "Skip" s WHERE s."userId"=${user.id} AND s."targetId"=u.id)
      ${context ? Prisma.empty : Prisma.sql`AND NOT EXISTS(SELECT 1 FROM "Connection" c WHERE c.status IN ('PENDING','ACCEPTED') AND ((c."requesterId"=${user.id} AND c."receiverId"=u.id) OR (c."receiverId"=${user.id} AND c."requesterId"=u.id)))`}
      ${filters.length ? Prisma.join(filters, ' ') : Prisma.empty}
    ), signals AS (
      SELECT *, (fc_overlap(${arr(wanted)},skills)>0)::int f,
        (fc_overlap(fc_link('intent',"lookingFor"),${arr(skills)})>0)::int r FROM candidates
    ), scored AS (
      SELECT *, LEAST(100,GREATEST(0,
        ${w.intent}*(f+r)/2.0+${w.reciprocal}*f*r+
        ${w.complement}*(fc_overlap(${arr(complement)},skills)>0)::int+
        ${w.interests}*LEAST(1,fc_overlap(${arr(interests)},interests)/${Math.max(1, Math.min(interests.length, 3))}::float)+
        ${w.collaboration}*(fc_overlap(${arr(looking)},"lookingFor")>0)::int+
        ${ranking.inferredWeight}*LEAST(1,fc_overlap(${arr(interests)},ARRAY(SELECT jsonb_array_elements_text(COALESCE(inferred->'interests','[]'::jsonb)))))+
        "postSignal"+${w.semantic}*semantic+${w.freshness}/(1+GREATEST(0,extract(epoch FROM CURRENT_TIMESTAMP-"updatedAt")/86400)/${ranking.profileFreshnessDays})+
        COALESCE((SELECT GREATEST(-${ranking.feedbackLimit},LEAST(${ranking.feedbackLimit},sum(CASE WHEN action IN ('PROFILE_SKIPPED','CONNECTION_REJECTED') THEN -1 ELSE 1 END))) FROM "RecommendationInteraction" ri WHERE ri."userId"=${user.id} AND ri."targetType"='PROFILE' AND ri."targetId"=signals.id AND ri."createdAt">CURRENT_TIMESTAMP-${ranking.feedbackDays}*interval '1 day'),0)
      ))::float score FROM signals
    ), coverage AS (
      SELECT id, row_number() OVER(PARTITION BY needed.skill ORDER BY score DESC,id) skill_rank
      FROM scored CROSS JOIN unnest(${arr(context?.requiredSkills ?? [])}) needed(skill)
      WHERE needed.skill=ANY(skills)
    ), diversity AS (SELECT id,min(skill_rank) skill_rank FROM coverage GROUP BY id)
    SELECT s.id,score,skills,interests,"lookingFor","postSignal",count(*) OVER() total FROM scored s
    LEFT JOIN diversity v ON v.id=s.id
    ORDER BY COALESCE(v.skill_rank,2147483647) ASC,score DESC,s.id ASC LIMIT ${limit} OFFSET ${recommendationPage(query) * limit}
  `);
  // Fetch only the bounded ranked page, rechecking visibility in case of concurrent moderation/blocking.
  const users = await db.user.findMany({
    where: {
      id: { in: rows.map((r) => r.id) },
      accountStatus: 'ACTIVE',
      onboarded: true,
      ...visibleTo(user.id),
    },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  const students = rows.flatMap((r) => {
    const u = byId.get(r.id);
    return u
      ? [
          {
            ...u,
            matchScore: Math.round(r.score),
            reasons: context?.requiredSkills?.length
              ? [
                  ...r.skills.filter((s) => context.requiredSkills!.includes(s)),
                  ...matchReasons(a, r),
                ].slice(0, ranking.maximumReasons)
              : [...matchReasons(a, r).slice(0, r.postSignal >= ranking.posts.reasonThreshold ? ranking.maximumReasons - 1 : ranking.maximumReasons), ...(r.postSignal >= ranking.posts.reasonThreshold ? ['Current interests align'] : [])],
          },
        ]
      : [];
  });
  console.info(
    JSON.stringify({
      event: 'recommendation_latency',
      kind: 'PROFILE',
      durationMs: Date.now() - start,
    }),
  );
  return { students, total: Number(rows[0]?.total ?? 0) };
}

export async function recommendedFeedIds(
  user: User,
  kind: 'IDEA' | 'EVENT',
  query: URLSearchParams,
  limit = 25,
) {
  const page = recommendationPage(query),
    category = query.get('category'),
    search = query.get('search')?.slice(0, 100);
  const interests = normalizeList('interests', [...user.interests, ...user.domains]);
  const skills = normalizeList('skills', user.skills);
  const f = ranking.feeds;
  const eventTerms = [...interests];
  if (
    skills.some((s) =>
      [
        'Web Development',
        'App Development',
        'Full Stack Development',
        'AI / Machine Learning',
      ].includes(s),
    )
  )
    eventTerms.push('Hackathon');
  if (interests.includes('Startups & Entrepreneurship') || interests.includes('E-Cells'))
    eventTerms.push('Pitch', 'Entrepreneurship', 'E-Cell');
  if (interests.includes('Gaming') || interests.includes('Esports'))
    eventTerms.push('Esports', 'Gaming');
  if (skills.some((s) => s.includes('Design'))) eventTerms.push('Design');
  if (skills.some((s) => ['Content Creation', 'Filmmaking', 'Video Editing'].includes(s)))
    eventTerms.push('Content', 'Film');
  const terms = [...new Set(kind === 'EVENT' ? eventTerms : interests)];
  const table = kind === 'IDEA' ? Prisma.raw('"Idea"') : Prisma.raw('"Event"');
  const filters: Prisma.Sql[] = [];
  if (category) filters.push(Prisma.sql`AND x.category=${category.slice(0, 60)}`);
  if (kind === 'IDEA') {
    filters.push(
      Prisma.sql`AND EXISTS(SELECT 1 FROM "User" u WHERE u.id=x."authorId" AND u."accountStatus"='ACTIVE') AND NOT EXISTS(SELECT 1 FROM "Block" b WHERE (b."blockerId"=${user.id} AND b."blockedId"=x."authorId") OR (b."blockedId"=${user.id} AND b."blockerId"=x."authorId"))`,
    );
    if (query.get('only') === 'true') filters.push(Prisma.sql`AND x."authorId"=${user.id}`);
    if (search)
      filters.push(
        Prisma.sql`AND strpos(lower(x.title||' '||x.description||' '||array_to_string(x.skills,' ')),lower(${search}))>0`,
      );
  } else {
    filters.push(Prisma.sql`AND x."startsAt">=CURRENT_TIMESTAMP`);
    if (query.get('only') === 'true')
      filters.push(
        Prisma.sql`AND EXISTS(SELECT 1 FROM "SavedEvent" s WHERE s."eventId"=x.id AND s."userId"=${user.id})`,
      );
    if (search)
      filters.push(Prisma.sql`AND strpos(lower(x.title||' '||x.location),lower(${search}))>0`);
  }
  const text =
    kind === 'IDEA'
      ? Prisma.sql`x.title||' '||x.description||' '||x.category||' '||array_to_string(x.tags,' ')`
      : Prisma.sql`x.title||' '||x.description||' '||x.category`;
  return db.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT x.id FROM ${table} x
    LEFT JOIN "RecommendationDocument" d ON d.kind=${kind} AND d."targetId"=x.id
    LEFT JOIN "RecommendationDocument" own ON own.kind='PROFILE' AND own."targetId"=${user.id}
    WHERE true ${filters.length ? Prisma.join(filters, ' ') : Prisma.empty}
    ORDER BY (
      ${f.interest}*LEAST(${f.overlapCap},fc_overlap(${arr(interests)},COALESCE(d.interests,fc_normalize('interests',ARRAY[x.category]))))+
      ${kind === 'IDEA' ? Prisma.sql`${f.skill}*LEAST(${f.overlapCap},fc_overlap(${arr(skills)},COALESCE(d.skills,fc_normalize('skills',x.skills))))+` : Prisma.empty}
      ${f.text}*(SELECT count(*) FROM unnest(${arr(terms)}) interest WHERE strpos(lower(${text}),lower(interest))>0)+
      ${f.inferred}*LEAST(${f.overlapCap},(SELECT count(*) FROM unnest(${arr(interests)}) interest WHERE interest IN (SELECT jsonb_array_elements_text(COALESCE(d.inferred->'interests','[]'::jsonb)))))+
      CASE WHEN d."embeddingModel"<>'' AND d."embeddingModel"=own."embeddingModel" THEN ${f.semantic}*GREATEST(0,fc_cosine(d.embedding,own.embedding)) ELSE 0 END+
      ${kind === 'IDEA' ? Prisma.sql`${f.freshness}/(1+GREATEST(0,extract(epoch FROM CURRENT_TIMESTAMP-x."createdAt")/86400)/${f.freshnessDays})+ LEAST(${f.engagement},ln(1+(SELECT count(*) FROM "IdeaResonance" r WHERE r."ideaId"=x.id)))` : Prisma.sql`${f.eventSoon}/(1+extract(epoch FROM x."startsAt"-CURRENT_TIMESTAMP)/86400/${f.eventDays})`}
    ) DESC, x.id ASC LIMIT ${limit} OFFSET ${page * 24}`);
}

export async function getRecommendedUsersForIdea(actor: string, ideaId: string) {
  const user = await requireActiveActor(actor);
  const idea = await db.idea.findFirst({
    where: { id: ideaId, author: { accountStatus: 'ACTIVE', ...visibleTo(actor) } },
  });
  requireThat(idea, 404, 'Idea unavailable.');
  const result = await rankedProfiles(
    user,
    new URLSearchParams(),
    {
      skills: [],
      interests: [idea.category, ...idea.tags],
      lookingFor: ['Startup Team', 'Project Teammates'],
      requiredSkills: normalizeList('skills', idea.skills),
      documentKind: 'IDEA',
      documentId: idea.id,
    },
    ranking.teamCandidates,
  );
  return { ...result, students: result.students.filter((u) => u.id !== idea.authorId) };
}
export async function recommendTeam(actor: string, input: unknown) {
  const data = teamRequestSchema.parse(input),
    user = await requireActiveActor(actor);
  let required = normalizeList('skills', data.requiredSkills);
  let candidates;
  if (data.ideaId) {
    const idea = await db.idea.findFirst({
      where: { id: data.ideaId, author: { accountStatus: 'ACTIVE', ...visibleTo(actor) } },
    });
    requireThat(idea, 404, 'Idea unavailable.');
    if (!required.length) required = normalizeList('skills', idea.skills);
    candidates = (
      await rankedProfiles(
        user,
        new URLSearchParams(),
        {
          skills: [],
          interests: [idea.category, ...idea.tags],
          lookingFor: ['Project Teammates', 'Startup Team'],
          requiredSkills: required,
          documentKind: 'IDEA',
          documentId: idea.id,
        },
        ranking.teamCandidates,
      )
    ).students.filter((u) => u.id !== idea.authorId);
  } else
    candidates = (
      await rankedProfiles(
        user,
        new URLSearchParams(),
        { ...user, requiredSkills: required },
        ranking.teamCandidates,
      )
    ).students;
  return balancedTeam(candidates, required, data.teamSize);
}
