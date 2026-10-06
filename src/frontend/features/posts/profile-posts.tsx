'use client';
import { useEffect, useState } from 'react';
import { useCircle } from '@/frontend/state/circle-context';
import { Loading } from '@/frontend/components/ui';
import type { ProfilePost, PostPage } from '@/shared/contracts/posts';
import { PostCard } from './post-card';
import { PostEditor } from './post-editor';

export function ProfilePosts({ authorId, onOpen }: { authorId: string; onOpen?: () => void }) {
  const { api, state } = useCircle();
  const [data, setData] = useState<PostPage<ProfilePost> | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    api.posts
      .list(authorId)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [api, authorId, retry]);
  return (
    <section className="profile-posts" aria-label="Profile posts">
      {authorId === state.me.id && !creating && (
        <button className="button primary" disabled={!data} onClick={() => setCreating(true)}>
          Create post
        </button>
      )}
      {creating && (
        <PostEditor
          onCancel={() => setCreating(false)}
          onSave={(post) => {
            setCreating(false);
            setData((old) => ({
              items: [post, ...(old?.items ?? []).filter((p) => p.id !== post.id)],
              nextCursor: old?.nextCursor ?? null,
            }));
          }}
        />
      )}
      {error && (
        <div role="alert">
          <p className="error">{error}</p>
          <button className="button secondary" onClick={() => setRetry((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}
      {!data && !error && <Loading />}
      {data && data.items.length === 0 && <p className="muted post-empty">No posts yet.</p>}
      {data?.items.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onOpen={onOpen}
          onChange={(p) =>
            setData(
              (old) =>
                old && { ...old, items: old.items.map((item) => (item.id === p.id ? p : item)) },
            )
          }
          onDelete={() =>
            setData(
              (old) => old && { ...old, items: old.items.filter((item) => item.id !== post.id) },
            )
          }
        />
      ))}
      {data?.nextCursor && (
        <button
          className="button secondary"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try {
              const more = await api.posts.list(authorId, data.nextCursor!);
              setData((old) => ({
                ...more,
                items: [
                  ...(old?.items ?? []),
                  ...more.items.filter((p) => !old?.items.some((existing) => existing.id === p.id)),
                ],
              }));
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not load posts.');
            } finally {
              setLoading(false);
            }
          }}
        >
          Load more
        </button>
      )}
    </section>
  );
}
