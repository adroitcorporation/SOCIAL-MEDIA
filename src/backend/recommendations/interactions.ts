import 'server-only';
import { db } from '@/backend/database/client';
import { requireActiveActor } from '@/backend/services/permissions';
import { visibleTo } from '@/backend/services/query-shapes';
import { requireThat } from '@/backend/utils/errors';
import { interactionSchema } from '@/shared/contracts/recommendations';

export async function recordProfileOpen(actor:string,input:unknown){
  const data=interactionSchema.parse(input);await requireActiveActor(actor);
  requireThat(await db.user.findFirst({where:{id:data.targetId,onboarded:true,accountStatus:'ACTIVE',...visibleTo(actor)}}),404,'Profile unavailable.');
  await recordInteraction(actor,'PROFILE',data.targetId,data.action);
  return {ok:true};
}
export async function recordInteraction(userId:string,targetType:'PROFILE'|'IDEA'|'EVENT',targetId:string,action:string){
  // One coarse event per action/target/day. No session traces, message bodies or IPs.
  await db.$executeRaw`INSERT INTO "RecommendationInteraction"("userId","targetType","targetId",action,day) VALUES(${userId},${targetType},${targetId},${action},CURRENT_DATE) ON CONFLICT DO NOTHING`;
}
