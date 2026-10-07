import 'server-only';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { db } from '@/backend/database/client';
import { transaction } from '@/backend/database/transaction';
import type { Tx } from '@/backend/types/database';
import { requireThat } from '@/backend/utils/errors';
import { requireActiveActor } from './permissions';
import { visibleTo } from './query-shapes';
import {
  commentSchema,
  createPostSchema,
  postSchema,
  postLimits,
  type ProfilePost,
} from '@/shared/contracts/posts';

const author = { id: true, name: true, photo: true, college: true } as const;
const activeVisible = (actor: string): Prisma.UserWhereInput => ({
  accountStatus: 'ACTIVE',
  onboarded: true,
  ...visibleTo(actor),
});
const visiblePost = (actor: string): Prisma.PostWhereInput => ({
  author: activeVisible(actor),
  OR: [
    { authorId: actor },
    { visibility: 'PUBLIC' },
    {
      visibility: 'CONNECTIONS_ONLY',
      author: {
        OR: [
          { sent: { some: { receiverId: actor, status: 'ACCEPTED' } } },
          { received: { some: { requesterId: actor, status: 'ACCEPTED' } } },
        ],
      },
    },
  ],
});
const includes = (actor: string) =>
  ({
    author: { select: author },
    likes: { where: { userId: actor }, select: { userId: true } },
    _count: {
      select: {
        likes: { where: { user: activeVisible(actor) } },
        comments: { where: { author: activeVisible(actor) } },
      },
    },
  }) satisfies Prisma.PostInclude;
type PostRow = Prisma.PostGetPayload<{ include: ReturnType<typeof includes> }>;
function present(post: PostRow, preview = false): ProfilePost {
  return {
    id: post.id,
    content: preview ? post.content.slice(0, postLimits.preview) : post.content,
    truncated: preview && post.content.length > postLimits.preview,
    visibility: post.visibility,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    author: post.author,
    likeCount: post._count.likes,
    commentCount: post._count.comments,
    liked: post.likes.length > 0,
  };
}
const cursorSchema = z
  .object({ id: z.string().min(1).max(100), date: z.string().datetime() })
  .strict();
function before(cursor?: string | null) {
  if (!cursor) return {};
  const value = z.string().max(400).parse(cursor);
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    requireThat(false, 400, 'Invalid cursor.');
  }
  const { id, date } = cursorSchema.parse(parsed);
  return {
    OR: [{ createdAt: { lt: new Date(date) } }, { createdAt: new Date(date), id: { lt: id } }],
  };
}
function next<T extends { id: string; createdAt: Date }>(rows: T[], limit: number) {
  const last = rows[limit - 1];
  return rows.length > limit
    ? Buffer.from(JSON.stringify({ id: last.id, date: last.createdAt.toISOString() })).toString(
        'base64url',
      )
    : null;
}
async function accessible(actor: string, id: string, tx: Tx = db) {
  const post = await tx.post.findFirst({ where: { id, ...visiblePost(actor) } });
  requireThat(post, 404, 'Post unavailable.');
  return post;
}
async function postingActor(actor: string, tx: Tx) {
  const user = await requireActiveActor(actor, tx);
  requireThat(user.onboarded, 403, 'Complete your profile first.');
}
async function limit(tx: Tx, actor: string, kind: 'post' | 'comment') {
  const hour = Math.floor(Date.now() / 3600000);
  const rate = await tx.rateLimit.upsert({
    where: { key: `${kind}:${actor}:${hour}` },
    create: { key: `${kind}:${actor}:${hour}`, expiresAt: new Date((hour + 2) * 3600000) },
    update: { count: { increment: 1 } },
  });
  requireThat(
    rate.count <= (kind === 'post' ? postLimits.postsPerHour : postLimits.commentsPerHour),
    429,
    'Please wait before posting again.',
  );
}
export async function listPosts(actor: string, authorId: string, cursor?: string | null) {
  await requireActiveActor(actor);
  requireThat(
    await db.user.findFirst({ where: { id: authorId, ...activeVisible(actor) } }),
    404,
    'Profile unavailable.',
  );
  const rows = await db.post.findMany({
    where: { AND: [{ authorId, ...visiblePost(actor) }, before(cursor)] },
    include: includes(actor),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: postLimits.page + 1,
  });
  return {
    items: rows.slice(0, postLimits.page).map((p) => present(p, true)),
    nextCursor: next(rows, postLimits.page),
  };
}
export async function getPost(actor: string, id: string) {
  await requireActiveActor(actor);
  const post = await db.post.findFirst({
    where: { id, ...visiblePost(actor) },
    include: includes(actor),
  });
  requireThat(post, 404, 'Post unavailable.');
  return present(post);
}
export async function createPost(actor: string, input: unknown) {
  const data = createPostSchema.parse(input);
  return transaction(async (tx) => {
    await postingActor(actor, tx);
    const prior = await tx.post.findUnique({
      where: { authorId_clientId: { authorId: actor, clientId: data.clientId } },
      include: includes(actor),
    });
    if (prior) {
      requireThat(
        prior.content === data.content && prior.visibility === data.visibility,
        409,
        'This submission was already saved. Open the post to edit it.',
      );
      return present(prior);
    }
    await limit(tx, actor, 'post');
    return present(
      await tx.post.create({ data: { ...data, authorId: actor }, include: includes(actor) }),
    );
  });
}
export async function editPost(actor: string, id: string, input: unknown) {
  const data = postSchema.parse(input);
  return transaction(async (tx) => {
    await postingActor(actor, tx);
    const post = await accessible(actor, id, tx);
    requireThat(post.authorId === actor, 403, 'Only the author can edit this post.');
    return present(await tx.post.update({ where: { id }, data, include: includes(actor) }));
  });
}
export async function deletePost(actor: string, id: string) {
  return transaction(async (tx) => {
    await requireActiveActor(actor, tx);
    const post = await accessible(actor, id, tx);
    requireThat(post.authorId === actor, 403, 'Only the author can delete this post.');
    await tx.post.delete({ where: { id } });
    return { ok: true };
  });
}
export async function likePost(actor: string, id: string, input: unknown) {
  const { enabled } = z.object({ enabled: z.boolean() }).strict().parse(input);
  return transaction(async (tx) => {
    await postingActor(actor, tx);
    await accessible(actor, id, tx);
    if (enabled)
      await tx.postLike.upsert({
        where: { postId_userId: { postId: id, userId: actor } },
        create: { postId: id, userId: actor },
        update: {},
      });
    else await tx.postLike.deleteMany({ where: { postId: id, userId: actor } });
    return {
      liked: enabled,
      likeCount: await tx.postLike.count({ where: { postId: id, user: activeVisible(actor) } }),
    };
  });
}
export async function listComments(actor: string, id: string, cursor?: string | null) {
  await requireActiveActor(actor);
  await accessible(actor, id);
  const rows = await db.postComment.findMany({
    where: {
      AND: [{ postId: id, post: visiblePost(actor), author: activeVisible(actor) }, before(cursor)],
    },
    select: { id: true, content: true, createdAt: true, author: { select: author } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: postLimits.commentsPage + 1,
  });
  return {
    items: rows
      .slice(0, postLimits.commentsPage)
      .map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
    nextCursor: next(rows, postLimits.commentsPage),
  };
}
export async function createComment(actor: string, id: string, input: unknown) {
  const data = commentSchema.parse(input);
  return transaction(async (tx) => {
    await postingActor(actor, tx);
    await accessible(actor, id, tx);
    const prior = await tx.postComment.findUnique({
      where: { authorId_clientId: { authorId: actor, clientId: data.clientId } },
    });
    if (prior) {
      requireThat(
        prior.postId === id && prior.content === data.content,
        409,
        'Submission already used.',
      );
      return { id: prior.id };
    }
    await limit(tx, actor, 'comment');
    const comment = await tx.postComment.create({ data: { ...data, authorId: actor, postId: id } });
    return { id: comment.id };
  });
}
export async function deleteComment(actor: string, id: string, commentId: string) {
  return transaction(async (tx) => {
    await requireActiveActor(actor, tx);
    await accessible(actor, id, tx);
    const comment = await tx.postComment.findFirst({ where: { id: commentId, postId: id } });
    requireThat(comment, 404, 'Comment unavailable.');
    requireThat(comment.authorId === actor, 403, 'Only the author can delete this comment.');
    await tx.postComment.delete({ where: { id: commentId } });
    return { ok: true };
  });
}
export async function reportPost(actor: string, id: string, input: unknown) {
  const { reason } = z
    .object({ reason: z.string().trim().min(3).max(2000) })
    .strict()
    .parse(input);
  return transaction(async (tx) => {
    await requireActiveActor(actor, tx);
    const post = await accessible(actor, id, tx);
    requireThat(post.authorId !== actor, 400, 'You cannot report your own post.');
    const prior = await tx.report.findFirst({
      where: { reporterId: actor, postId: id, status: { in: ['OPEN', 'REVIEWED', 'ESCALATED'] } },
    });
    if (prior) return { id: prior.id };
    const report = await tx.report.create({
      data: {
        reporterId: actor,
        targetId: post.authorId,
        postId: id,
        postContent: post.content,
        reason,
      },
    });
    return { id: report.id };
  });
}
