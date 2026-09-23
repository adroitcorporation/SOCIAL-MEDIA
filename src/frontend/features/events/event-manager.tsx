'use client';
import { useEffect, useState } from 'react';
import { useCircle } from '@/frontend/state/circle-context';
import type { EventItem } from '@/shared/contracts/responses';
import { eventSchema } from '@/shared/contracts/moderation';
import { Pagination } from '@/frontend/components/pagination';
import { Modal } from '@/frontend/components/ui';

export function EventManager() {
  const { api, mutate, busy, toast } = useCircle();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [editing, setEditing] = useState<EventItem | 'new' | null>(null);
  const [deleting, setDeleting] = useState<EventItem | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.events
      .managed(new URLSearchParams({ search, page: String(page) }).toString())
      .then((items) => {
        if (active) setEvents(items);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, revision, page, search]);
  const item = editing && editing !== 'new' ? editing : null;
  return (
    <section className="panel moderation-section">
      <div className="moderation-actions">
        <h2>Manage events</h2>
        <button className="button primary" onClick={() => setEditing('new')}>
          Create event
        </button>
      </div>
      <label>
        Search your manageable events
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Event title"
        />
      </label>
      <p className="muted">Includes past events. 100 events per page.</p>
      {loading ? (
        <p>Loading events…</p>
      ) : error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : !events.length ? (
        <p className="muted">No events to manage yet. Create your first event.</p>
      ) : (
        events.map((event) => (
          <div className="managed-event" key={event.id}>
            <span>
              <strong>{event.title}</strong>
              <br />
              <small>{new Date(event.startsAt).toLocaleString()}</small>
            </span>
            <div className="moderation-actions">
              <button className="button secondary" onClick={() => setEditing(event)}>
                Edit
              </button>
              <button className="button secondary danger" onClick={() => setDeleting(event)}>
                Delete
              </button>
            </div>
          </div>
        ))
      )}
      <Pagination page={page} setPage={setPage} count={events.length} loading={loading} />
      {editing && (
        <Modal title={item ? 'Edit event' : 'Create event'} onClose={() => setEditing(null)}>
          <form
            className="event-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const raw = Object.fromEntries(form);
              const date = new Date(String(raw.startsAt));
              const parsed = eventSchema.safeParse({
                ...raw,
                startsAt: Number.isNaN(date.getTime()) ? '' : date.toISOString(),
              });
              if (!parsed.success) {
                toast(parsed.error.issues[0].message, true);
                return;
              }
              try {
                await mutate(() =>
                  item ? api.events.edit(item.id, parsed.data) : api.events.create(parsed.data),
                );
                setEditing(null);
                setRevision((v) => v + 1);
                toast('Event saved.');
              } catch {}
            }}
          >
            <label>
              Title
              <input name="title" required maxLength={120} defaultValue={item?.title} />
            </label>
            <label>
              Description
              <textarea
                name="description"
                required
                maxLength={5000}
                defaultValue={item?.description}
              />
            </label>
            <label>
              Category
              <input name="category" required maxLength={60} defaultValue={item?.category} />
            </label>
            <label>
              Organiser name
              <input name="organizer" required maxLength={120} defaultValue={item?.organizer} />
            </label>
            <label>
              Location
              <input name="location" required maxLength={200} defaultValue={item?.location} />
            </label>
            <label>
              Start time (your local time)
              <input
                type="datetime-local"
                name="startsAt"
                required
                defaultValue={
                  item
                    ? new Date(
                        new Date(item.startsAt).getTime() -
                          new Date(item.startsAt).getTimezoneOffset() * 60000,
                      )
                        .toISOString()
                        .slice(0, 16)
                    : ''
                }
              />
            </label>
            <label>
              Event website (HTTPS)
              <input type="url" name="url" required maxLength={2048} defaultValue={item?.url} />
            </label>
            <button className="button primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save event'}
            </button>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal title="Delete event?" onClose={() => setDeleting(null)}>
          <p>Delete “{deleting.title}”? This also removes saved bookmarks.</p>
          <button
            className="button primary"
            disabled={busy}
            onClick={async () => {
              try {
                await mutate(() => api.events.delete(deleting.id));
                setDeleting(null);
                setRevision((v) => v + 1);
                toast('Event deleted.');
              } catch {}
            }}
          >
            Confirm deletion
          </button>
        </Modal>
      )}
    </section>
  );
}
