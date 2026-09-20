'use client';
import { relative } from '@/frontend/utils/date';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Zap, Plus, Search, Users, Lightbulb, ArrowRight } from 'lucide-react';
import type { IdeaItem, ResonanceItem } from '@/shared/contracts/responses';
import { useCircle } from '@/frontend/state/circle-context';
import { Avatar, Empty, Modal, Tag } from '@/frontend/components/ui';
import { PageHeading } from '@/frontend/components/page-heading';

export function IdeaCard({ idea, compact = false }: { idea: IdeaItem; compact?: boolean }) {
  const { api, state, mutate, busy, viewProfile } = useCircle();
  const [detail, setDetail] = useState(false);
  const mine = idea.authorId === state.me.id;
  const resonated = idea.resonances.length > 0;
  useEffect(() => {
    if (new URLSearchParams(location.search).get('idea') === idea.id) setDetail(true);
  }, [idea.id]);
  return (
    <>
      <article className={`idea-card ${compact ? 'compact' : ''}`}>
        <div className="idea-top">
          <button className="idea-author" onClick={() => viewProfile(idea.author)}>
            <Avatar user={idea.author} size="small" />
            <span>
              <strong>{idea.author.name}</strong>
              <small>
                {idea.author.college} <span>· {relative(idea.createdAt)}</span>
              </small>
            </span>
          </button>
          <span className="category-label">{idea.category}</span>
        </div>
        <button className="idea-title" onClick={() => setDetail(true)}>
          {idea.title}
        </button>
        <p className="idea-description">{idea.description}</p>
        <div className="tags">
          {idea.skills.slice(0, 4).map((s) => (
            <Tag key={s}>{s}</Tag>
          ))}
          {idea.tags.slice(0, 2).map((s) => (
            <span className="hashtag" key={s}>
              #{s}
            </span>
          ))}
        </div>
        <div className="idea-bottom">
          <button
            disabled={busy || mine}
            aria-pressed={resonated}
            className={`resonate-button ${resonated ? 'resonated' : ''}`}
            onClick={async () => {
              try {
                await mutate(() => api.ideas.resonate(idea.id, { enabled: !resonated }));
              } catch {}
            }}
          >
            <Zap size={16} fill={resonated ? 'currentColor' : 'none'} />
            {mine ? 'Resonances' : resonated ? 'Resonated' : 'Resonate'}
            <span>{idea._count.resonances}</span>
          </button>
          <button className="text-link" onClick={() => setDetail(true)}>
            {mine ? 'Manage idea' : 'View idea'}
            <ArrowUpRight size={15} />
          </button>
        </div>
      </article>
      {detail && <IdeaDetail idea={idea} onClose={() => setDetail(false)} />}
    </>
  );
}
function IdeaDetail({ idea: initial, onClose }: { idea: IdeaItem; onClose: () => void }) {
  const { state, api, mutate, busy, viewProfile, navigate, toast } = useCircle();
  const idea = state.ideas.find((i) => i.id === initial.id) || initial;
  const mine = idea.authorId === state.me.id;
  const [people, setPeople] = useState<ResonanceItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const existing = state.conversations.find((c) => c.ideaId === idea.id);
  useEffect(() => {
    if (!mine) return;
    const load = () =>
      api.ideas
        .resonances(idea.id)
        .then(setPeople)
        .catch((e) => setError(e.message));
    void load();
    window.addEventListener('circle-refresh', load);
    return () => window.removeEventListener('circle-refresh', load);
  }, [api, idea.id, mine]);
  return (
    <Modal title="One idea. A world of possibility." onClose={onClose} wide>
      <div className="idea-detail">
        <span className="tag">{idea.category}</span>
        <h2>{idea.title}</h2>
        <button className="idea-author" onClick={() => viewProfile(idea.author)}>
          <Avatar user={idea.author} size="small" />
          <span>
            <strong>{idea.author.name}</strong>
            <small>{idea.author.college}</small>
          </span>
        </button>
        <p className="full-description">{idea.description}</p>
        <h4>Skills that could bring this to life</h4>
        <div className="tags">
          {idea.skills.map((s) => (
            <Tag key={s}>{s}</Tag>
          ))}
        </div>
        <div className="tags">
          {idea.tags.map((s) => (
            <span className="hashtag" key={s}>
              #{s}
            </span>
          ))}
        </div>
        {mine ? (
          <section className="resonance-section">
            <div className="section-heading">
              <div>
                <h3>
                  People who resonated <span className="count-pill">{people.length}</span>
                </h3>
                <p>
                  {idea.conversation
                    ? 'Invite new people into your existing collaboration group.'
                    : 'Choose the people you’d like to start building with.'}
                </p>
              </div>
            </div>
            {error && <p className="error">{error}</p>}
            {people.map((p) => {
              const member = existing?.members.some((m) => m.userId === p.userId);
              return (
                <div className="select-person" key={p.userId}>
                  <input
                    aria-label={`Select ${p.user.name}`}
                    type="checkbox"
                    checked={member || selected.includes(p.userId)}
                    disabled={member}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, p.userId]
                          : selected.filter((id) => id !== p.userId),
                      )
                    }
                  />
                  <Avatar user={p.user} size="small" />
                  <button className="person-label" onClick={() => viewProfile(p.user)}>
                    <strong>{p.user.name}</strong>
                    <small>
                      {p.user.college} · {p.user.skills.slice(0, 3).join(', ')}
                    </small>
                    <small>{relative(p.createdAt)}</small>
                  </button>
                  {member && <span className="tag">In group</span>}
                </div>
              );
            })}
            {!people.length && (
              <p className="muted">Your idea is out there. The right collaborators will find it.</p>
            )}
            <div className="dialog-actions">
              {idea.conversation && (
                <button
                  className="button secondary"
                  onClick={() => {
                    onClose();
                    navigate(`/messages?conversation=${idea.conversation!.id}`);
                  }}
                >
                  Open group <ArrowUpRight size={15} />
                </button>
              )}
              <button
                className="button primary"
                disabled={busy || (Boolean(idea.conversation) && !selected.length)}
                onClick={async () => {
                  try {
                    const group = await mutate(() =>
                      api.ideas.group(idea.id, {
                        memberIds: selected,
                      }),
                    );
                    toast(
                      idea.conversation
                        ? 'New collaborators added to your group.'
                        : 'Your collaboration group is ready.',
                    );
                    onClose();
                    navigate(`/messages?conversation=${group.id}`);
                  } catch {}
                }}
              >
                <Users size={16} />
                {idea.conversation
                  ? `Add selected (${selected.length})`
                  : 'Create collaboration group'}
              </button>
            </div>
          </section>
        ) : (
          <button
            className={`button ${idea.resonances.length ? 'secondary' : 'primary'}`}
            disabled={busy}
            onClick={async () => {
              try {
                await mutate(() =>
                  api.ideas.resonate(idea.id, { enabled: !idea.resonances.length }),
                );
              } catch {}
            }}
          >
            <Zap size={16} fill={idea.resonances.length ? 'currentColor' : 'none'} />
            {idea.resonances.length ? 'Remove resonance' : 'This resonates with me'} ·{' '}
            {idea._count.resonances}
          </button>
        )}
      </div>
    </Modal>
  );
}
export function IdeasPage() {
  const { api, state, mutate, toast } = useCircle();
  const [create, setCreate] = useState(false);
  const [mine, setMine] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All ideas');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const categories = ['All ideas', ...new Set(state.ideas.map((i) => i.category))];
  const items = state.ideas.filter(
    (i) =>
      (!mine || i.authorId === state.me.id) &&
      (category === 'All ideas' || category === i.category) &&
      `${i.title} ${i.description} ${i.skills.join(' ')}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const f = new FormData(event.currentTarget);
    const split = (key: string) =>
      String(f.get(key) || '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    try {
      await mutate(() =>
        api.ideas.create({
          title: String(f.get('title')),
          description: String(f.get('description')),
          category: String(f.get('category')),
          skills: split('skills'),
          tags: split('tags'),
        }),
      );
      setCreate(false);
      toast('Your idea is out in the world. Let’s see who resonates.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="IT STARTS WITH A SPARK"
        title="Ideas are better out in the open."
        description="Half-formed thoughts welcome. Find someone who sees what you see."
      >
        <button className="button primary" onClick={() => setCreate(true)}>
          <Plus size={17} />
          Share an idea
        </button>
      </PageHeading>
      <div className="idea-banner">
        <span>✳</span>
        <div>
          <h3>You bring the ‘what if’. Your circle brings the ‘why not’.</h3>
          <p>A side project, a creative experiment, a competition team. There’s room for it all.</p>
        </div>
        <Lightbulb size={32} />
      </div>
      <div className="filter-panel filter-top">
        <div className="search-field">
          <Search size={18} />
          <input
            aria-label="Search ideas"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a spark by topic, skill, or idea…"
          />
        </div>
        <button
          className={`button ${mine ? 'primary' : 'secondary'}`}
          onClick={() => setMine(!mine)}
        >
          My ideas
        </button>
      </div>
      <div className="category-chips">
        {categories.map((c) => (
          <button key={c} className={category === c ? 'active' : ''} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="ideas-grid">
        {items.map((i) => (
          <IdeaCard idea={i} key={i.id} />
        ))}
      </div>
      {!items.length && (
        <Empty
          title="A blank canvas. Your move."
          body="Share an idea you can’t stop thinking about, or try another search."
        >
          <button className="button primary" onClick={() => setCreate(true)}>
            Share an idea <ArrowRight size={16} />
          </button>
        </Empty>
      )}
      {create && (
        <Modal title="Put your idea out there." onClose={() => setCreate(false)}>
          <form onSubmit={submit}>
            <p className="muted">It doesn’t have to be perfect. It just has to start somewhere.</p>
            <label>
              Give it a name
              <input name="title" placeholder="What if we built…" required maxLength={120} />
            </label>
            <label>
              The idea
              <textarea
                name="description"
                placeholder="What’s the idea, who is it for, and what kind of help are you looking for?"
                required
                rows={5}
                maxLength={5000}
              />
            </label>
            <label>
              Category
              <select name="category">
                {[
                  'Technology',
                  'Design',
                  'Social impact',
                  'Startup',
                  'Hackathon',
                  'Creative',
                  'Gaming',
                  'Research',
                  'Other',
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Skills needed
              <input
                name="skills"
                placeholder="React, UI/UX, Storytelling (comma-separated)"
                maxLength={1000}
              />
            </label>
            <label>
              Tags
              <input name="tags" placeholder="sustainability, campus, community" maxLength={1000} />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary full" disabled={saving}>
              {saving ? 'Sharing…' : 'Share with your circle'}
              <ArrowUpRight size={16} />
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
