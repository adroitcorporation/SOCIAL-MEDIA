import 'server-only';
import { errorResponse } from './error-response';
import { z } from 'zod';
import { authenticate } from '@/backend/auth/session';
import { handleConfigRequest } from './config-handler';
import { db } from '@/backend/database/client';
import { AppError, requireThat } from '@/backend/utils/errors';
import { boundedJson } from '@/backend/http/request';
import * as service from '@/backend/services/community';
import * as events from '@/backend/services/events';
import * as moderation from '@/backend/services/moderation';
import * as posts from '@/backend/services/posts';
import { requireActiveActor, requirePermission } from '@/backend/services/permissions';
import { canViewModerationDashboard, canAssignRole } from '@/shared/contracts/permissions';

import { validateMutationRequest, enforceMutationRateLimit } from './middleware';
import { present } from './presenters';
import {
  rankedProfiles,
  recommendTeam,
  getRecommendedUsersForIdea,
} from '@/backend/recommendations/service';
import { searchColleges } from '@/backend/recommendations/colleges';
import { recordInteraction, recordProfileOpen } from '@/backend/recommendations/interactions';
import { connectionActionSchema } from '@/shared/contracts/schemas';
export async function handleApiRequest(request: Request, path: string[]) {
  try {
    const [resource, id, action, detail] = path;
    const method = request.method;
    if (resource === 'health') {
      await db.$queryRaw`SELECT 1`;
      return Response.json({ status: 'ok' });
    }
    if (resource === 'config' && method === 'GET') return handleConfigRequest();
    if (method !== 'GET') validateMutationRequest(request);
    const identity = await authenticate(request);
    const user = await requireActiveActor(identity.id);
    if (resource === 'moderation') await requirePermission(user.id, canViewModerationDashboard);
    let input: Record<string, unknown> = {};
    if (method !== 'GET') {
      input = z
        .record(z.string(), z.unknown())
        .parse(await boundedJson(request, resource === 'verification' ? 7_100_000 : resource === 'posts' ? 80_000 : 20_000));
      await enforceMutationRateLimit(user.id);
    }
    let result: unknown;
    if (resource === 'posts' && !id && method === 'POST') result = await posts.createPost(user.id, input);
    else if (resource === 'students' && id && action === 'posts' && !detail && method === 'GET') result = await posts.listPosts(user.id, id, new URL(request.url).searchParams.get('cursor'));
    else if (resource === 'posts' && id && !action && method === 'GET') result = await posts.getPost(user.id, id);
    else if (resource === 'posts' && id && !action && method === 'PATCH') result = await posts.editPost(user.id, id, input);
    else if (resource === 'posts' && id && !action && method === 'DELETE') result = await posts.deletePost(user.id, id);
    else if (resource === 'posts' && id && action === 'like' && !detail && method === 'POST') result = await posts.likePost(user.id, id, input);
    else if (resource === 'posts' && id && action === 'comments' && !detail && method === 'GET') result = await posts.listComments(user.id, id, new URL(request.url).searchParams.get('cursor'));
    else if (resource === 'posts' && id && action === 'comments' && !detail && method === 'POST') result = await posts.createComment(user.id, id, input);
    else if (resource === 'posts' && id && action === 'comments' && detail && method === 'DELETE') result = await posts.deleteComment(user.id, id, detail);
    else if (resource === 'posts' && id && action === 'report' && !detail && method === 'POST') result = await posts.reportPost(user.id, id, input);
    else if (resource === 'colleges' && !id && method === 'GET')
      result = await searchColleges(new URL(request.url).searchParams.get('search') || '');
    else if (resource === 'recommendations' && id === 'people' && method === 'GET')
      result = await rankedProfiles(user, new URL(request.url).searchParams);
    else if (resource === 'recommendations' && id === 'team' && method === 'POST')
      result = await recommendTeam(user.id, input);
    else if (resource === 'recommendations' && id === 'ideas' && action && method === 'GET')
      result = await getRecommendedUsersForIdea(user.id, action);
    else if (resource === 'recommendations' && id === 'interactions' && method === 'POST')
      result = await recordProfileOpen(user.id, input);
    else if (resource === 'session' && !id && method === 'GET')
      result = { id: user.id, role: user.role, accountStatus: user.accountStatus };
    else if (resource === 'moderation' && id === 'access' && method === 'GET') {
      if (new URL(request.url).searchParams.get('roles') === 'true')
        await requirePermission(user.id, (actor) => canAssignRole(actor, 'STUDENT'));
      result = { ok: true };
    } else if (resource === 'moderation' && id === 'dashboard' && !action && method === 'GET')
      result = present.dashboard(await moderation.dashboard(user.id));
    else if (resource === 'moderation' && id === 'reports' && !action && method === 'GET')
      result = present.reports(
        await moderation.listReports(user.id, new URL(request.url).searchParams),
      );
    else if (
      resource === 'moderation' &&
      id === 'reports' &&
      action &&
      !detail &&
      method === 'PATCH'
    )
      result = await moderation.reviewReport(user.id, action, input);
    else if (
      resource === 'moderation' &&
      (id === 'users' || id === 'roles') &&
      !action &&
      method === 'GET'
    )
      result = present.moderationUsers(
        await moderation.listModerationUsers(
          user.id,
          new URL(request.url).searchParams,
          id === 'roles',
        ),
      );
    else if (
      resource === 'moderation' &&
      id === 'users' &&
      action &&
      (detail === 'role' || detail === 'status') &&
      method === 'PATCH'
    )
      result = await moderation.changeUser(user.id, action, input, detail);
    else if (resource === 'reports' && !id && method === 'POST')
      result = await moderation.submitReport(user.id, input);
    else if (resource === 'events' && id === 'managed' && method === 'GET')
      result = await events.managedEvents(user.id, new URL(request.url).searchParams);
    else if (resource === 'events' && !id && method === 'POST')
      result = await events.createEvent(user.id, input);
    else if (resource === 'events' && id && !action && method === 'PATCH')
      result = await events.editEvent(user.id, id, input);
    else if (resource === 'events' && id && !action && method === 'DELETE')
      result = await events.deleteEvent(user.id, id);
    else if (resource === 'state' && method === 'GET')
      result = present.state(await service.snapshot(user, new URL(request.url).searchParams));
    else if (resource === 'verification' && method === 'GET' && !id)
      result = present.verification(await service.latestVerification(user.id));
    else if (resource === 'verification' && method === 'POST' && !id)
      result = present.verification(await service.submitVerification(user.id, input));
    else if (
      resource === 'moderation' &&
      id === 'verifications' &&
      action &&
      detail === 'document' &&
      method === 'GET'
    ) {
      const document = await service.verificationDocument(user.id, action);
      return new Response(new Uint8Array(document.documentBytes), {
        headers: {
          'Content-Type': document.documentMime,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } else if (resource === 'moderation' && id === 'verifications' && !action && method === 'GET')
      result = (await service.listVerificationRequests(user.id)).map(present.verificationReview);
    else if (
      resource === 'moderation' &&
      id === 'verifications' &&
      action &&
      !detail &&
      method === 'PATCH'
    )
      result = present.verification(await service.reviewVerification(user.id, action, input));
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
    else if (resource === 'conversations' && id && !action && method === 'DELETE')
      result = await service.clearConversation(user.id, id);
    else if (resource === 'conversations' && id && method === 'PATCH')
      result = present.groupUpdate(await service.manageGroup(user.id, id, input));
    else if (resource === 'conversations' && id && action === 'messages' && method === 'POST')
      result = present.message(await service.sendMessage(user.id, id, input));
    else if (
      resource === 'conversations' &&
      id &&
      action === 'messages' &&
      detail &&
      method === 'DELETE'
    )
      result = await service.deleteMessage(user.id, id, detail);
    else if (resource === 'conversations' && id && action === 'messages' && method === 'GET')
      result = present.messages(
        await service.readMessages(
          user.id,
          id,
          new URL(request.url).searchParams.get('before') || undefined,
          new URL(request.url).searchParams.get('after') || undefined,
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
    try {
      if (resource === 'skips' && id && method === 'POST')
        await recordInteraction(user.id, 'PROFILE', id, 'PROFILE_SKIPPED');
      if (resource === 'ideas' && id && action === 'resonate' && input.enabled === true)
        await recordInteraction(user.id, 'IDEA', id, 'IDEA_RESONATED');
      if (resource === 'events' && id && method === 'POST' && input.saved === true)
        await recordInteraction(user.id, 'EVENT', id, 'EVENT_SAVED');
      if (
        resource === 'conversations' &&
        !id &&
        input.type === 'DIRECT' &&
        typeof input.userId === 'string'
      )
        await recordInteraction(user.id, 'PROFILE', input.userId, 'MESSAGE_STARTED');
      if (resource === 'connections' && (method === 'POST' || method === 'PATCH')) {
        const c = result as { requesterId: string; receiverId: string };
        const name =
          method === 'POST'
            ? 'CONNECTION_SENT'
            : input.action === 'accept'
              ? 'CONNECTION_ACCEPTED'
              : input.action === 'reject'
                ? 'CONNECTION_REJECTED'
                : null;
        if (name)
          await recordInteraction(
            user.id,
            'PROFILE',
            c.requesterId === user.id ? c.receiverId : c.requesterId,
            name,
          );
      }
    } catch {
      console.warn(JSON.stringify({ event: 'recommendation_feedback_failed' }));
    }
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
