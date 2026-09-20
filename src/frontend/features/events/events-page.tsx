'use client';

import { useState } from 'react';

import { ArrowUpRight, CalendarDays, MapPin, Search, Bookmark } from 'lucide-react';
import type { AppState } from '@/shared/contracts/responses';

import { useCircle } from '@/frontend/state/circle-context';
import { Empty, Modal } from '@/frontend/components/ui';

import { PageHeading } from '@/frontend/components/page-heading';
export function EventsPage() {
  const { api, state, mutate, busy } = useCircle();
  const [category, setCategory] = useState('All events');
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<AppState['events'][number] | null>(null);
  const categories = ['All events', ...new Set(state.events.map((e) => e.category))];
  const events = state.events.filter(
    (e) =>
      (category === 'All events' || e.category === category) &&
      (!saved || e.savedBy.length) &&
      `${e.title} ${e.location}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="TAKE YOUR CURIOSITY PLACES"
        title="Something worth showing up for."
        description="Hackathons, creative challenges, workshops, and everything in between."
      />
      <div className="filter-panel filter-top">
        <div className="search-field">
          <Search size={18} />
          <input
            aria-label="Search events"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find an event or city…"
          />
        </div>
        <button
          className={`button ${saved ? 'primary' : 'secondary'}`}
          onClick={() => setSaved(!saved)}
        >
          <Bookmark size={15} />
          {saved ? 'Saved events' : 'Show saved'}
        </button>
      </div>
      <div className="category-chips">
        {categories.map((c) => (
          <button key={c} className={category === c ? 'active' : ''} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="events-grid">
        {events.map((event, i) => (
          <article className="event-card" key={event.id}>
            <button
              className={`event-art event-art-${i % 3}`}
              onClick={() => setDetail(event)}
              aria-label={`View ${event.title}`}
            >
              <span>
                {event.category === 'Hackathon' ? '</>' : event.category === 'Design' ? '✳' : '↗'}
              </span>
              <small>{event.category.toUpperCase()}</small>
              <div className="event-date">
                <b>{new Date(event.startsAt).getDate()}</b>
                {new Date(event.startsAt).toLocaleDateString('en-IN', { month: 'short' })}
              </div>
            </button>
            <div className="event-body">
              <span className="eyebrow">{event.organizer}</span>
              <h2>{event.title}</h2>
              <p>{event.description}</p>
              <div className="event-meta">
                <span>
                  <MapPin size={15} />
                  {event.location}
                </span>
                <span>
                  <CalendarDays size={15} />
                  {new Date(event.startsAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    timeZone: 'Asia/Kolkata',
                  })}
                </span>
              </div>
              <div className="event-actions">
                <button className="button secondary" onClick={() => setDetail(event)}>
                  View event <ArrowUpRight size={15} />
                </button>
                <button
                  disabled={busy}
                  className={`icon-button ${event.savedBy.length ? 'saved' : ''}`}
                  aria-label={event.savedBy.length ? 'Unsave event' : 'Save event'}
                  onClick={async () => {
                    try {
                      await mutate(() =>
                        api.events.save(event.id, { saved: !event.savedBy.length }),
                      );
                    } catch {}
                  }}
                >
                  <Bookmark size={19} fill={event.savedBy.length ? 'currentColor' : 'none'} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!events.length && (
        <Empty
          title="The next opportunity is on its way."
          body="Try a different category or check back for new events."
        />
      )}
      {detail && (
        <Modal title={detail.title} onClose={() => setDetail(null)}>
          <span className="tag">{detail.category}</span>
          <p className="modal-description">{detail.description}</p>
          <p>
            <strong>Hosted by</strong> {detail.organizer}
          </p>
          <p>
            {detail.location} ·{' '}
            {new Date(detail.startsAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
          </p>
          {detail.url.startsWith('https://') ? (
            <a
              className="button primary"
              href={detail.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              Visit event website <ArrowUpRight size={16} />
            </a>
          ) : (
            <p className="notice">
              This is a sample event for the local demo. Registration is not available.
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
