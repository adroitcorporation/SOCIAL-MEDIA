'use client';
import { useRef, useState } from 'react';
import { useCircle } from '@/frontend/state/circle-context';
import { postLimits, type ProfilePost } from '@/shared/contracts/posts';

export function PostEditor({ post, onSave, onCancel }: { post?: ProfilePost; onSave: (post: ProfilePost) => void; onCancel: () => void }) {
  const { api } = useCircle();
  const [content, setContent] = useState(post?.content ?? '');
  const [visibility, setVisibility] = useState<ProfilePost['visibility']>(post?.visibility ?? 'PUBLIC');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sending = useRef(false);
  const clientId = useRef<string | null>(null);
  return <form className="post-editor" onSubmit={async (event) => {
    event.preventDefault();
    if (sending.current) return;
    sending.current = true; setBusy(true); setError('');
    try {
      clientId.current ??= crypto.randomUUID();
      const input = { content, visibility };
      onSave(post ? await api.posts.edit(post.id, input) : await api.posts.create({ ...input, clientId: clientId.current }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save post.'); }
    finally { sending.current = false; setBusy(false); }
  }}>
    <label>Post content<textarea autoFocus rows={5} required maxLength={postLimits.content} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Share what you're working on..." /></label>
    <div className="post-editor-footer">
      <label>Who can see this?<select value={visibility} onChange={(e) => setVisibility(e.target.value as ProfilePost['visibility'])}><option value="PUBLIC">Everyone in Founder’s Circle</option><option value="CONNECTIONS_ONLY">Connections only</option></select></label>
      <small className="muted">{content.length.toLocaleString()} / {postLimits.content.toLocaleString()}</small>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="post-actions"><button className="button primary" disabled={busy || !content.trim()}>{busy ? 'Saving…' : post ? 'Save' : 'Post'}</button><button type="button" className="button secondary" onClick={onCancel} disabled={busy}>Cancel</button></div>
  </form>;
}
