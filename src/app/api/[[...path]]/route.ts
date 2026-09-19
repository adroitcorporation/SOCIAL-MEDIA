import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { authenticate, isLocalDemo } from '@/lib/auth';
import { db } from '@/lib/db';
import { AppError, requireThat } from '@/lib/errors';
import { boundedJson } from '@/lib/request';
import * as service from '@/services/community';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ path?: string[] }> };
async function handler(request: Request, context: Context) {
  try {
    const path = (await context.params).path ?? [];
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
    if (method !== 'GET') {
      const origin = request.headers.get('origin');
      const expected =
        process.env.APP_URL ||
        (process.env.NODE_ENV !== 'production' ? new URL(request.url).origin : undefined);
      requireThat(expected, 503, 'APP_URL must be configured.');
      requireThat(!origin || origin === expected, 403, 'Invalid request origin.');
      requireThat(
        (request.headers.get('content-type') || '').includes('application/json'),
        415,
        'Send JSON.',
      );
    }
    const user = await authenticate(request);
    let input: Record<string, unknown> = {};
    if (method !== 'GET') {
      input = z.record(z.string(), z.unknown()).parse(await boundedJson(request));
      const bucket = `${user.id}:${Math.floor(Date.now() / 60000)}`;
      const rate = await db.rateLimit.upsert({
        where: { key: bucket },
        create: { key: bucket, expiresAt: new Date(Date.now() + 120000) },
        update: { count: { increment: 1 } },
      });
      requireThat(rate.count <= 90, 429, 'Please wait a moment before trying again.');
      await db.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    }
    if (resource !== 'profile' && resource !== 'state')
      requireThat(user.onboarded, 403, 'Complete your student profile first.');
    let result: unknown;
    if (resource === 'state' && method === 'GET')
      result = await service.snapshot(user, new URL(request.url).searchParams);
    else if (resource === 'profile' && method === 'PATCH')
      result = await service.saveProfile(user.id, input);
    else if (resource === 'students' && id && method === 'GET') {
      requireThat(
        !(await db.block.findFirst({
          where: {
            OR: [
              { blockerId: user.id, blockedId: id },
              { blockerId: id, blockedId: user.id },
            ],
          },
        })),
        403,
        'Profile unavailable.',
      );
      result = await db.user.findUnique({ where: { id } });
      requireThat(result, 404, 'Student not found.');
    } else if (resource === 'connections' && method === 'POST' && !id)
      result = await service.requestConnection(user.id, z.string().max(100).parse(input.userId));
    else if (resource === 'connections' && id && method === 'PATCH')
      result = await service.transitionConnection(
        user.id,
        id,
        z.enum(['accept', 'reject', 'cancel']).parse(input.action),
      );
    else if (resource === 'blocks' && id && method === 'POST')
      result = await service.blockUser(user.id, id);
    else if (resource === 'blocks' && id && method === 'DELETE')
      result = await db.block.deleteMany({ where: { blockerId: user.id, blockedId: id } });
    else if (resource === 'skips' && method === 'DELETE')
      result = await db.skip.deleteMany({ where: { userId: user.id } });
    else if (resource === 'skips' && id && method === 'POST')
      result = await db.skip.upsert({
        where: { userId_targetId: { userId: user.id, targetId: id } },
        create: { userId: user.id, targetId: id },
        update: {},
      });
    else if (resource === 'conversations' && method === 'POST' && !id)
      result =
        input.type === 'DIRECT'
          ? await service.directConversation(user.id, z.string().max(100).parse(input.userId))
          : await service.createGroup(user.id, input);
    else if (resource === 'conversations' && id && method === 'PATCH')
      result = await service.manageGroup(user.id, id, input);
    else if (resource === 'conversations' && id && action === 'messages' && method === 'POST')
      result = await service.sendMessage(user.id, id, input);
    else if (resource === 'conversations' && id && action === 'messages' && method === 'GET')
      result = await service.readMessages(
        user.id,
        id,
        new URL(request.url).searchParams.get('before') || undefined,
      );
    else if (resource === 'ideas' && !id && method === 'POST')
      result = await service.createIdea(user.id, input);
    else if (resource === 'ideas' && id && action === 'resonate' && method === 'POST')
      result = await service.resonate(user.id, id, z.boolean().parse(input.enabled));
    else if (resource === 'ideas' && id && action === 'group' && method === 'POST')
      result = await service.getOrCreateIdeaGroup(
        user.id,
        id,
        z.array(z.string().max(100)).max(49).parse(input.memberIds),
      );
    else if (resource === 'ideas' && id && action === 'resonances' && method === 'GET') {
      requireThat(
        await db.idea.findFirst({ where: { id, authorId: user.id } }),
        403,
        'Only the idea author can see who resonated.',
      );
      result = await db.ideaResonance.findMany({
        where: { ideaId: id },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });
    } else if (resource === 'events' && id && method === 'POST') {
      const key = { eventId: id, userId: user.id };
      result =
        input.saved === true
          ? await db.savedEvent.upsert({ where: { userId_eventId: key }, create: key, update: {} })
          : await db.savedEvent.deleteMany({ where: key });
    } else if (resource === 'notifications' && method === 'PATCH')
      result = await db.notification.updateMany({
        where: { userId: user.id, ...(id ? { id } : {}), readAt: null },
        data: { readAt: new Date() },
      });
    else throw new AppError(404, 'Endpoint not found.');
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AppError)
      return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError)
      return Response.json(
        { error: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') },
        { status: 400 },
      );
    if (error instanceof SyntaxError)
      return Response.json({ error: 'Invalid JSON.' }, { status: 400 });
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2003', 'P2025', 'P2034'].includes(error.code)
    )
      return Response.json(
        { error: 'This item changed or is unavailable. Refresh and try again.' },
        { status: 409 },
      );
    console.error('API request failed', error instanceof Error ? error.message : 'Unknown error');
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
