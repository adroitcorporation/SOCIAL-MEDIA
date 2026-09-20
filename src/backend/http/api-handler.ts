import 'server-only';
import { errorResponse } from './error-response';
import { z } from 'zod';
import { authenticate, isLocalDemo } from '@/backend/auth/session';
import { db } from '@/backend/database/client';
import { AppError, requireThat } from '@/backend/utils/errors';
import { boundedJson } from '@/backend/http/request';
import * as service from '@/backend/services/community';

import { validateMutationRequest, enforceMutationRateLimit } from './middleware';
import { present } from './presenters';
import { connectionActionSchema } from '@/shared/contracts/schemas';
export async function handleApiRequest(request: Request, path: string[]) {
  try {
    const [resource, id, action] = path;
    const method = request.method;
    if (resource === 'health') {
      await db.$queryRaw`SELECT 1`;
      return Response.json({ status: 'ok' });
    }
    if (resource === 'config' && method === 'GET')
      return Response.json({
        demo: isLocalDemo(),
        configured: Boolean(
          process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        ),
      });
    if (method !== 'GET') validateMutationRequest(request);
    const user = await authenticate(request);
    let input: Record<string, unknown> = {};
    if (method !== 'GET') {
      input = z.record(z.string(), z.unknown()).parse(await boundedJson(request));
      await enforceMutationRateLimit(user.id);
    }
    if (resource !== 'profile' && resource !== 'state')
      requireThat(user.onboarded, 403, 'Complete your student profile first.');
    let result: unknown;
    if (resource === 'state' && method === 'GET')
      result = present.state(await service.snapshot(user, new URL(request.url).searchParams));
    else if (resource === 'profile' && method === 'PATCH')
      result = present.student(await service.saveProfile(user.id, input));
    else if (resource === 'students' && id && method === 'GET')
      result = present.student(await service.getStudent(user.id, id));
    else if (resource === 'connections' && method === 'POST' && !id)
      result = present.connection(
        await service.requestConnection(user.id, z.string().max(100).parse(input.userId)),
      );
    else if (resource === 'connections' && id && method === 'PATCH')
      result = present.connection(
        await service.transitionConnection(user.id, id, connectionActionSchema.parse(input.action)),
      );
    else if (resource === 'blocks' && id && method === 'POST')
      result = await service.blockUser(user.id, id);
    else if (resource === 'blocks' && id && method === 'DELETE')
      result = await service.unblockUser(user.id, id);
    else if (resource === 'skips' && method === 'DELETE')
      result = await service.clearSkips(user.id);
    else if (resource === 'skips' && id && method === 'POST')
      result = await service.skipStudent(user.id, id);
    else if (resource === 'conversations' && method === 'POST' && !id)
      result =
        input.type === 'DIRECT'
          ? await service.directConversation(user.id, z.string().max(100).parse(input.userId))
          : await service.createGroup(user.id, input);
    else if (resource === 'conversations' && id && method === 'PATCH')
      result = present.groupUpdate(await service.manageGroup(user.id, id, input));
    else if (resource === 'conversations' && id && action === 'messages' && method === 'POST')
      result = present.message(await service.sendMessage(user.id, id, input));
    else if (resource === 'conversations' && id && action === 'messages' && method === 'GET')
      result = present.messages(
        await service.readMessages(
          user.id,
          id,
          new URL(request.url).searchParams.get('before') || undefined,
        ),
      );
    else if (resource === 'ideas' && !id && method === 'POST')
      result = present.idea(await service.createIdea(user.id, input));
    else if (resource === 'ideas' && id && action === 'resonate' && method === 'POST')
      result = await service.resonate(user.id, id, z.boolean().parse(input.enabled));
    else if (resource === 'ideas' && id && action === 'group' && method === 'POST')
      result = present.conversation(
        await service.getOrCreateIdeaGroup(
          user.id,
          id,
          z.array(z.string().max(100)).max(49).parse(input.memberIds),
        ),
      );
    else if (resource === 'ideas' && id && action === 'resonances' && method === 'GET')
      result = present.resonances(await service.listResonances(user.id, id));
    else if (resource === 'events' && id && method === 'POST')
      result = await service.saveEvent(user.id, id, input.saved);
    else if (resource === 'notifications' && method === 'PATCH')
      result = await service.markNotificationsRead(user.id, id);
    else throw new AppError(404, 'Endpoint not found.');
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
