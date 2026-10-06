'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Heart, MessageCircle, Link as LinkIcon, Lock } from 'lucide-react';
import { useCircle } from '@/frontend/state/circle-context';
import { Avatar } from '@/frontend/components/ui';
import type { ProfilePost } from '@/shared/contracts/posts';
import { PostEditor } from './post-editor';

export function PostCard({
  post,
  full = false,
  onChange,
  onDelete,
  onOpen,
}: {
  post: ProfilePost;
  full?: boolean;
  onChange: (p: ProfilePost) => void;
  onDelete: () => void;
  onOpen?: () => void;
}) {
  const { api, state, viewProfile, toast } = useCircle();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<ProfilePost | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('Spam');
  const own = post.author.id === state.me.id;
  async function act(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await operation();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not complete action.', true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="post-card">
      <header className="post-header">
        <button
          className="post-author"
          onClick={() => act(async () => viewProfile(await api.profiles.get(post.author.id)))}
          aria-label={`View ${post.author.name}'s profile`}
          disabled={busy}
        >
          <Avatar user={post.author} size="small" />
          <span>
            <strong>{post.author.name}</strong>
            <small className="muted">{post.author.college}</small>
          </span>
        </button>
        <Link href={`/posts/${post.id}`} onClick={onOpen} className="post-date">
          <time dateTime={post.createdAt}>
            {new Date(post.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </time>
        </Link>
      </header>
      {post.visibility === 'CONNECTIONS_ONLY' && (
        <small className="post-privacy">
          <Lock size={13} /> Connections only
        </small>
      )}
      {editing ? (
        <PostEditor
          post={editing}
          onSave={(p) => {
            setEditing(null);
            onChange(p);
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <>
          <p className={`post-content ${full ? '' : 'post-preview'}`}>{post.content}</p>
          {!full && (
            <Link href={`/posts/${post.id}`} className="text-link" onClick={onOpen}>
              {post.truncated || post.content.length > 220 || post.content.split('\n').length > 4
                ? 'Read more'
                : 'Open post'}
            </Link>
          )}
        </>
      )}
      <div className="post-actions">
        <button
          className={`button secondary ${post.liked ? 'post-liked' : ''}`}
          aria-label={post.liked ? 'Unlike' : 'Like'}
          aria-pressed={post.liked}
          disabled={busy}
          onClick={() =>
            act(async () => onChange({ ...post, ...(await api.posts.like(post.id, !post.liked)) }))
          }
        >
          <Heart size={17} fill={post.liked ? 'currentColor' : 'none'} />
          <span>{post.likeCount}</span>
        </button>
        <Link className="button secondary" href={`/posts/${post.id}#comments`} onClick={onOpen}>
          <MessageCircle size={17} />
          {post.commentCount}
          <span className="sr-only"> comments</span>
        </Link>
        <button
          className="icon-button"
          aria-label="Copy post link"
          onClick={() =>
            act(async () => {
              await navigator.clipboard.writeText(`${location.origin}/posts/${post.id}`);
              toast('Link copied.');
            })
          }
        >
          <LinkIcon size={17} />
        </button>
        {own ? (
          <>
            <button
              className="text-link"
              disabled={busy}
              onClick={() => act(async () => setEditing(await api.posts.get(post.id)))}
            >
              Edit
            </button>
            <button className="text-link danger" disabled={busy} onClick={() => setConfirm(true)}>
              Delete
            </button>
          </>
        ) : (
          <button className="text-link" onClick={() => setReporting(!reporting)}>
            Report
          </button>
        )}
      </div>
      {confirm && (
        <div className="post-confirm" role="group" aria-label="Delete post confirmation">
          <p>Delete this post and its comments? This cannot be undone.</p>
          <button
            className="button danger"
            disabled={busy}
            onClick={() =>
              act(async () => {
                await api.posts.delete(post.id);
                onDelete();
              })
            }
          >
            Delete post
          </button>
          <button className="button secondary" disabled={busy} onClick={() => setConfirm(false)}>
            Cancel
          </button>
        </div>
      )}
      {reporting && (
        <form
          className="post-report"
          onSubmit={(e) => {
            e.preventDefault();
            void act(async () => {
              await api.posts.report(post.id, reason);
              setReporting(false);
              toast('Report submitted.');
            });
          }}
        >
          <label>
            Report reason
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {[
                'Spam',
                'Harassment',
                'Inappropriate content',
                'Scam',
                'Misleading content',
                'Other',
              ].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <div className="post-actions">
            <button className="button secondary" disabled={busy}>
              Submit report
            </button>
            <button type="button" className="text-link" onClick={() => setReporting(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </article>
  );
}
