import { z } from 'zod';

export const postLimits = { content: 10000, comment: 2000, preview: 500, page: 10, commentsPage: 20, postsPerHour: 10, commentsPerHour: 60 } as const;
const content = (max: number) => z.string().trim().min(1, 'Write something first.').max(max).refine((s) => !s.includes('\0'), 'Invalid character.');
export const postSchema = z.object({ content: content(postLimits.content), visibility: z.enum(['PUBLIC', 'CONNECTIONS_ONLY']).default('PUBLIC') }).strict();
export const createPostSchema = postSchema.extend({ clientId: z.string().uuid() });
export const commentSchema = z.object({ content: content(postLimits.comment), clientId: z.string().uuid() }).strict();
export type PostInput = z.input<typeof postSchema>;
export interface PostAuthor { id: string; name: string; photo: string; college: string }
export interface ProfilePost {
  id: string;
  content: string;
  truncated: boolean;
  visibility: 'PUBLIC' | 'CONNECTIONS_ONLY';
  createdAt: string;
  updatedAt: string;
  author: PostAuthor;
  likeCount: number;
  commentCount: number;
  liked: boolean;
}
export interface PostComment { id: string; content: string; createdAt: string; author: PostAuthor }
export interface PostPage<T> { items: T[]; nextCursor: string | null }
