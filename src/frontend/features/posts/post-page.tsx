'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useCircle } from '@/frontend/state/circle-context';
import { Avatar, Loading } from '@/frontend/components/ui';
import { PageHeading } from '@/frontend/components/page-heading';
import {
  postLimits,
  type PostComment,
  type PostPage as PageData,
  type ProfilePost,
} from '@/shared/contracts/posts';
import { PostCard } from './post-card';

export function PostPage({ id }: { id: string }) {
  const { api, state, navigate, viewProfile, toast } = useCircle();
  const [post, setPost] = useState<ProfilePost | null>(null);
  const [comments, setComments] = useState<PageData<PostComment>>({ items: [], nextCursor: null });
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const clientId = useRef<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setPost(null);
    setError('');
    Promise.all([api.posts.get(id), api.posts.comments(id)])
      .then(([p, c]) => {
        if (active) {
          setPost(p);
          setComments(c);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [api, id, retry]);
  async function action(fn: () => Promise<void>) {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not complete action.', true);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="post-page">
      <PageHeading title="Post">
        <Link className="button secondary" href="/profile">
          My profile
        </Link>
      </PageHeading>
      {error ? (
        <div className="panel" role="alert">
          <p>{error}</p>
          <button className="button secondary" onClick={() => setRetry((n) => n + 1)}>
            Retry
          </button>
        </div>
      ) : !post ? (
        <Loading />
      ) : (
        <>
          <PostCard post={post} full onChange={setPost} onDelete={() => navigate('/profile')} />
          <section id="comments" className="panel post-comments">
            <h2>Comments</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void action(async () => {
                  clientId.current ??= crypto.randomUUID();
                  await api.posts.comment(id, content, clientId.current);
                  setContent('');
                  clientId.current = null;
                  const [p, c] = await Promise.all([api.posts.get(id), api.posts.comments(id)]);
                  setPost(p);
                  setComments(c);
                });
              }}
            >
              <label>
                Comment
                <textarea
                  placeholder="Add a comment..."
                  disabled={busy}
                  maxLength={postLimits.comment}
                  rows={3}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </label>
              <button className="button primary" disabled={busy || !content.trim()}>
                Comment
              </button>
            </form>
            {!comments.items.length && <p className="muted post-empty">No comments yet.</p>}
            {comments.items.map((comment) => (
              <article className="post-comment" key={comment.id}>
                <button className="post-author" onClick={() => viewProfile(comment.author)}>
                  <Avatar user={comment.author} size="small" />
                  <strong>{comment.author.name}</strong>
                </button>
                <time className="muted" dateTime={comment.createdAt}>
                  {new Date(comment.createdAt).toLocaleDateString()}
                </time>
                <p className="post-content">{comment.content}</p>
                {comment.author.id === state.me.id &&
                  (deleting === comment.id ? (
                    <div className="post-actions">
                      <span>Delete comment?</span>
                      <button
                        className="text-link danger"
                        disabled={busy}
                        onClick={() =>
                          action(async () => {
                            await api.posts.deleteComment(id, comment.id);
                            setComments((old) => ({
                              ...old,
                              items: old.items.filter((c) => c.id !== comment.id),
                            }));
                            setPost(
                              (old) =>
                                old && { ...old, commentCount: Math.max(0, old.commentCount - 1) },
                            );
                            setDeleting(null);
                          })
                        }
                      >
                        Confirm delete
                      </button>
                      <button className="text-link" onClick={() => setDeleting(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button className="text-link danger" onClick={() => setDeleting(comment.id)}>
                      Delete comment
                    </button>
                  ))}
              </article>
            ))}
            {comments.nextCursor && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  action(async () => {
                    const more = await api.posts.comments(id, comments.nextCursor!);
                    setComments((old) => ({
                      ...more,
                      items: [
                        ...old.items,
                        ...more.items.filter(
                          (c) => !old.items.some((existing) => existing.id === c.id),
                        ),
                      ],
                    }));
                  })
                }
              >
                Load more comments
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
