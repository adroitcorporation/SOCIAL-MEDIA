import 'server-only';
import { Prisma } from '@prisma/client';
import { ranking } from './config';

const arr = (values: string[]) => values.length ? Prisma.sql`ARRAY[${Prisma.join(values)}]::text[]` : Prisma.sql`'{}'::text[]`;
// Correlated against candidate u. Only bounded recent public posts contribute; never sum
// a prolific author's posts. The strongest signal decays from its original creation date.
export function postSignalSql(actor: string, skills: string[], interests: string[]) {
  const p = ranking.posts;
  return Prisma.sql`COALESCE((
    SELECT max(GREATEST(
      CASE WHEN fc_overlap(fc_link('intent',ARRAY(SELECT jsonb_array_elements_text(COALESCE(d.inferred->'lookingFor','[]'::jsonb)))),
        CASE WHEN recent."authorId"=${actor} THEN fc_normalize('skills',u.skills) ELSE ${arr(skills)} END)>0 THEN ${p.maxWeight} ELSE 0 END,
      CASE WHEN fc_overlap(ARRAY(SELECT jsonb_array_elements_text(COALESCE(d.inferred->'interests','[]'::jsonb))),
        CASE WHEN recent."authorId"=${actor} THEN fc_normalize('interests',u.interests) ELSE ${arr(interests)} END)>0 THEN ${p.topicWeight} ELSE 0 END
    )*power(0.5,GREATEST(0,extract(epoch FROM CURRENT_TIMESTAMP-recent."createdAt")/86400)/${p.halfLifeDays}))
    FROM (
      (SELECT id,"authorId","createdAt" FROM "Post" WHERE "authorId"=u.id AND visibility='PUBLIC' AND "createdAt">CURRENT_TIMESTAMP-${p.maxAgeDays}*interval '1 day' ORDER BY "createdAt" DESC,id DESC LIMIT ${p.recentLimit})
      UNION ALL
      (SELECT id,"authorId","createdAt" FROM "Post" WHERE "authorId"=${actor} AND visibility='PUBLIC' AND "createdAt">CURRENT_TIMESTAMP-${p.maxAgeDays}*interval '1 day' ORDER BY "createdAt" DESC,id DESC LIMIT ${p.recentLimit})
    ) recent JOIN "RecommendationDocument" d ON d.kind='POST' AND d."targetId"=recent.id
  ),0)::float`;
}
