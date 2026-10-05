import 'server-only';
import { db } from '@/backend/database/client';
import type { CollegeOption } from '@/shared/contracts/recommendations';
export async function searchColleges(search: string) {
  const term = search.trim().slice(0, 100);
  return db.$queryRaw<
    CollegeOption[]
  >`SELECT id,name,"shortName",city,state,country,aliases FROM "College" c WHERE active AND (${term}='' OR strpos(fc_key(c.name),fc_key(${term}))>0 OR strpos(fc_key(c."shortName"),fc_key(${term}))>0 OR EXISTS(SELECT 1 FROM unnest(c.aliases) a WHERE strpos(fc_key(a),fc_key(${term}))>0)) ORDER BY name LIMIT 20`;
}
