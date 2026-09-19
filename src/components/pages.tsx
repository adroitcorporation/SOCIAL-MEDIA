'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Users,
  Lightbulb,
  CalendarDays,
  MapPin,
  Plus,
  Check,
  X,
  SlidersHorizontal,
  Search,
  Bookmark,
  MessageCircle,
  Sparkles,
  GraduationCap,
  Bell,
  CheckCheck,
  Compass,
  Pencil,
  Heart,
  Globe,
} from 'lucide-react';
import type { AppState, Student } from '@/lib/types';
import { useCircle } from './circle-context';
import { Avatar, Empty, Modal, Tag, Verified, relative } from './ui';
import { ProfileDetails, ProfileForm } from './profile-form';
import { IdeaCard } from './ideas';

export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
export function StudentCard({ student }: { student: Student }) {
  const { state, mutate, busy, viewProfile, toast } = useCircle();
  const connection = state.connections.find((c) =>
    [c.requesterId, c.receiverId].includes(student.id),
  );
  const pending = connection?.status === 'PENDING';
  const outgoing = connection?.requesterId === state.me.id;
  const shared = student.interests.filter((i) => state.me.interests.includes(i));
  return (
    <article className="student-card">
      <div className="student-top">
        <Avatar user={student} size="large" />
        <button
          className="icon-button"
          aria-label={`View ${student.name}'s profile`}
          onClick={() => viewProfile(student)}
        >
          <ArrowUpRight size={19} />
        </button>
      </div>
      <button className="student-name" onClick={() => viewProfile(student)}>
        {student.name}
        <Verified user={student} />
      </button>
      <p className="student-degree">
        {student.degree} <span>· {student.graduationYear}</span>
      </p>
      <p className="college">
        <GraduationCap size={14} />
        {student.college}
      </p>
      <p className="student-bio">{student.bio || 'Ready to find a new collaboration.'}</p>
      <div className="tags">
        {student.skills.slice(0, 3).map((s) => (
          <Tag key={s}>{s}</Tag>
        ))}
        {student.skills.length > 3 && <Tag>+{student.skills.length - 3}</Tag>}
      </div>
      <div className="looking">
        <span className="status-dot" />
        {student.lookingFor[0] || 'Open to collaborating'}
      </div>
      {shared.length > 0 && (
        <div className="shared">
          <Sparkles size={12} />
          {shared.length} shared interest{shared.length === 1 ? '' : 's'}
        </div>
      )}
      <div className="student-actions">
        {pending ? (
          <>
            <span className="pending-label">{outgoing ? 'Request Sent' : 'Wants to connect'}</span>
            <button
              disabled={busy}
              className="button small secondary"
              onClick={async () => {
                try {
                  await mutate(
                    `connections/${connection.id}`,
                    { action: outgoing ? 'cancel' : 'accept' },
                    'PATCH',
                  );
                  toast(outgoing ? 'Request cancelled.' : 'You’re connected!');
                } catch {}
              }}
            >
              {outgoing ? 'Cancel Request' : 'Accept'}
            </button>
          </>
        ) : (
          <>
            <button
              disabled={busy}
              className="button secondary connect"
              onClick={async () => {
                try {
                  await mutate('connections', { userId: student.id });
                  toast('Request sent. A new connection starts here.');
                } catch {}
              }}
            >
              <Plus size={15} />
              Connect
            </button>
            <button
              disabled={busy}
              className="icon-button skip"
              aria-label={`Skip ${student.name}`}
              onClick={async () => {
                try {
                  await mutate(`skips/${student.id}`);
                } catch {}
              }}
            >
              <X size={17} />
            </button>
          </>
        )}
      </div>
    </article>
  );
}
export function HomePage() {
  const { state } = useCircle();
  const accepted = state.connections.filter((c) => c.status === 'ACCEPTED');
  const incoming = state.connections.filter(
    (c) => c.status === 'PENDING' && c.receiverId === state.me.id,
  );
  return (
    <>
      <PageHeading
        eyebrow="A LITTLE CURIOSITY GOES A LONG WAY"
        title={`Hey ${state.me.name.split(' ')[0]}, welcome to your circle.`}
        description="New people. Fresh ideas. Your next possibility is here."
      />
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-kicker">
            <span /> BETTER, TOGETHER
          </span>
          <h2>
            Big ideas start
            <br />
            with a <em>small hello.</em>
          </h2>
          <p>
            Find the designer to your developer. The doer to your dreamer.
            <br className="desktop-break" /> Your people are here. Go meet them.
          </p>
          <Link href="/discover" className="button dark">
            Discover your people <ArrowUpRight size={17} />
          </Link>
          <div className="hero-foot">
            <span className="mini-avatars">
              {state.students.slice(0, 3).map((u) => (
                <Avatar key={u.id} user={u} size="small" />
              ))}
            </span>
            <span>A little connection. A world of possibility.</span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <div className="orbit-core">
            <span>✳</span>
            <small>
              your next
              <br />
              big thing
            </small>
          </div>
          <div className="orbit-chip chip-design">
            <span>✦</span> design thinkers
          </div>
          <div className="orbit-chip chip-build">
            <span>⌘</span> passionate builders
          </div>
          <div className="orbit-chip chip-create">
            <span>↗</span> curious creators
          </div>
          <div className="orbit-person person-one">A</div>
          <div className="orbit-person person-two">R</div>
          <div className="orbit-star star-one">✧</div>
          <div className="orbit-star star-two">✳</div>
        </div>
      </section>
      <div className="stats-row">
        {[
          {
            icon: Users,
            value: accepted.length,
            label: 'Your connections',
            note: incoming.length
              ? `${incoming.length} new requests waiting`
              : 'Your people, all in one place',
            href: '/connections',
            color: 'mint',
          },
          {
            icon: Lightbulb,
            value: state.ideas.length,
            label: 'Ideas to explore',
            note: 'A spark could start something',
            href: '/ideas',
            color: 'peach',
          },
          {
            icon: CalendarDays,
            value: state.events.length,
            label: 'Upcoming events',
            note: 'Show up. Stand out. Team up.',
            href: '/events',
            color: 'lavender',
          },
        ].map((stat) => (
          <Link href={stat.href} className="stat-card" key={stat.label}>
            <span className={`stat-icon ${stat.color}`}>
              <stat.icon size={21} />
            </span>
            <div>
              <div className="stat-value">
                {stat.value}
                <span>{stat.label}</span>
              </div>
              <p>{stat.note}</p>
            </div>
            <ArrowUpRight size={18} />
          </Link>
        ))}
      </div>
      <div className="home-columns">
        <div className="home-main">
          <div className="section-heading">
            <div>
              <h2>
                Your kind of people <span className="tiny-pill">A GOOD PLACE TO START</span>
              </h2>
              <p>Different skills. Shared curiosity. Endless possibilities.</p>
            </div>
            <Link href="/discover" className="text-link">
              View all <ArrowRight size={15} />
            </Link>
          </div>
          <div className="student-grid home-students">
            {state.students.slice(0, 3).map((student) => (
              <StudentCard key={student.id} student={student} />
            ))}
          </div>
          {!state.students.length && (
            <Empty
              title="Your circle is growing"
              body="New students will appear here as they join."
            />
          )}
          <div className="section-heading ideas-section-heading">
            <div>
              <h2>A little spark of inspiration</h2>
              <p>Ideas looking for a fresh perspective. Maybe yours.</p>
            </div>
            <Link href="/ideas" className="text-link">
              IdeaBoard <ArrowRight size={15} />
            </Link>
          </div>
          {state.ideas.slice(0, 2).map((idea) => (
            <IdeaCard key={idea.id} idea={idea} compact />
          ))}
          {!state.ideas.length && (
            <div className="panel">
              <p>No ideas yet. Yours could be the first.</p>
              <Link className="text-link" href="/ideas">
                Share an idea <ArrowRight size={15} />
              </Link>
            </div>
          )}
        </div>
        <aside className="home-right">
          <div className="section-heading">
            <h2>On the horizon</h2>
            <Link href="/events" className="icon-button" aria-label="View all events">
              <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="event-stack">
            {state.events.slice(0, 3).map((event, i) => (
              <Link href="/events" className="mini-event" key={event.id}>
                <div className={`event-art event-art-${i}`}>
                  <span>
                    {event.category === 'Hackathon'
                      ? '</>'
                      : event.category === 'Design'
                        ? '✳'
                        : '↗'}
                  </span>
                  <small>{event.category.toUpperCase()}</small>
                  <div className="event-date">
                    <b>{new Date(event.startsAt).getDate()}</b>
                    {new Date(event.startsAt).toLocaleDateString('en-IN', { month: 'short' })}
                  </div>
                </div>
                <h3>{event.title}</h3>
                <p>
                  <MapPin size={12} />
                  {event.location}
                </p>
                <div className="mini-event-bottom">
                  <span>{event.organizer}</span>
                  <ArrowUpRight size={15} />
                </div>
              </Link>
            ))}
          </div>
          {!state.events.length && (
            <div className="panel">
              <p>New opportunities are on their way.</p>
            </div>
          )}
          <div className="community-note">
            <span>✴</span>
            <h3>
              You don’t have to
              <br />
              figure it out alone.
            </h3>
            <p>Somewhere in this circle, someone is looking for exactly what you bring.</p>
            <Link href="/profile" className="text-link">
              Let them find you <ArrowRight size={14} />
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
export function DiscoverPage() {
  const { state, refresh, mutate, toast } = useCircle();
  const [filters, setFilters] = useState(false);
  const [search, setSearch] = useState('');
  useEffect(() => {
    setSearch(new URLSearchParams(location.search).get('search') || '');
  }, []);
  async function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    new FormData(event.currentTarget).forEach((value, key) => {
      if (String(value).trim()) params.set(key, String(value).trim());
    });
    history.replaceState(null, '', `/discover?${params}`);
    try {
      await refresh();
    } catch (e) {
      toast((e as Error).message, true);
    }
  }
  const page =
    typeof window !== 'undefined'
      ? Number(new URLSearchParams(location.search).get('page') || 0)
      : 0;
  return (
    <>
      <PageHeading
        eyebrow="PEOPLE MAKE THE DIFFERENCE"
        title="Find your kind of people."
        description="A future teammate, a fresh perspective, or a friend who just gets it."
      />
      <form className="filter-panel" onSubmit={apply}>
        <div className="filter-top">
          <div className="search-field">
            <Search size={18} />
            <input
              name="search"
              placeholder="Search by name, college, city, or a little curiosity…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            className={`button ${filters ? 'primary' : 'secondary'}`}
            onClick={() => setFilters(!filters)}
          >
            <SlidersHorizontal size={16} />
            Filters
          </button>
          <button className="button primary">Find people</button>
        </div>
        <div className={`filter-fields ${filters ? 'expanded' : ''}`}>
          {[
            ['college', 'College'],
            ['city', 'City'],
            ['skills', 'Skill (e.g. React)'],
            ['domains', 'Domain'],
            ['interests', 'Interest'],
            ['lookingFor', 'Looking for'],
            ['graduationYear', 'Graduation year'],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                name={key}
                placeholder={label}
                type={key === 'graduationYear' ? 'number' : 'text'}
                min={key === 'graduationYear' ? 2020 : undefined}
                max={key === 'graduationYear' ? 2040 : undefined}
              />
            </label>
          ))}
        </div>
      </form>
      <div className="results-bar">
        <span>
          <strong>{state.totalStudents}</strong> people to discover
        </span>
        <button
          className="text-link"
          onClick={async () => {
            try {
              await mutate('skips', {}, 'DELETE');
              toast('Skipped profiles are back in your discovery feed.');
            } catch {}
          }}
        >
          Show skipped profiles
        </button>
      </div>
      <div className="student-grid discover-grid">
        {state.students.map((s) => (
          <StudentCard key={s.id} student={s} />
        ))}
      </div>
      {!state.students.length && (
        <Empty
          title="A wider circle is out there."
          body="Try a different skill, city, or college, or bring back your skipped profiles."
        />
      )}
      <div className="pagination">
        <button
          className="button secondary"
          disabled={page <= 0}
          onClick={async () => {
            const p = new URLSearchParams(location.search);
            p.set('page', String(page - 1));
            history.replaceState(null, '', `/discover?${p}`);
            await refresh();
          }}
        >
          Previous
        </button>
        <span>Page {page + 1}</span>
        <button
          className="button secondary"
          disabled={(page + 1) * 12 >= state.totalStudents}
          onClick={async () => {
            const p = new URLSearchParams(location.search);
            p.set('page', String(page + 1));
            history.replaceState(null, '', `/discover?${p}`);
            await refresh();
          }}
        >
          Next <ArrowRight size={15} />
        </button>
      </div>
    </>
  );
}
export function ConnectionsPage() {
  const { state, mutate, busy, viewProfile, navigate, toast } = useCircle();
  const [tab, setTab] = useState('accepted');
  const groups = {
    accepted: state.connections.filter((c) => c.status === 'ACCEPTED'),
    incoming: state.connections.filter(
      (c) => c.status === 'PENDING' && c.receiverId === state.me.id,
    ),
    sent: state.connections.filter((c) => c.status === 'PENDING' && c.requesterId === state.me.id),
  };
  async function act(id: string, action: string) {
    try {
      await mutate(`connections/${id}`, { action }, 'PATCH');
      toast(
        action === 'accept'
          ? 'You’re connected. Say hello!'
          : action === 'cancel'
            ? 'Request cancelled.'
            : 'Request declined.',
      );
    } catch {}
  }
  return (
    <>
      <PageHeading
        eyebrow="GOOD COMPANY, GREAT POSSIBILITIES"
        title="Your circle, growing."
        description="Keep the connections that turn ‘what if’ into ‘let’s do it’."
      >
        <button className="button primary" onClick={() => navigate('/messages?create=group')}>
          <Plus size={16} />
          Create group
        </button>
      </PageHeading>
      <div className="tabs">
        {[
          ['accepted', 'Connections'],
          ['incoming', 'Incoming Requests'],
          ['sent', 'Sent Requests'],
        ].map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
            <span>{groups[id as keyof typeof groups].length}</span>
          </button>
        ))}
      </div>
      <div className="connection-grid">
        {groups[tab as keyof typeof groups].map((c) => {
          const student = c.requesterId === state.me.id ? c.receiver : c.requester;
          return (
            <article className="connection-card panel" key={c.id}>
              <div className="connection-person">
                <Avatar user={student} size="large" />
                <div>
                  <button className="student-name" onClick={() => viewProfile(student)}>
                    {student.name}
                    <Verified user={student} />
                  </button>
                  <p>{student.college}</p>
                  <small>{student.degree}</small>
                </div>
              </div>
              <div className="tags">
                {student.skills.slice(0, 4).map((s) => (
                  <Tag key={s}>{s}</Tag>
                ))}
              </div>
              <div className="connection-actions">
                {tab === 'accepted' ? (
                  <button
                    disabled={busy}
                    className="button primary"
                    onClick={async () => {
                      try {
                        const result = await mutate<{ id: string }>('conversations', {
                          type: 'DIRECT',
                          userId: student.id,
                        });
                        navigate(`/messages?conversation=${result.id}`);
                      } catch {}
                    }}
                  >
                    <MessageCircle size={15} />
                    Message
                  </button>
                ) : tab === 'incoming' ? (
                  <>
                    <button
                      disabled={busy}
                      className="button primary"
                      onClick={() => act(c.id, 'accept')}
                    >
                      <Check size={15} />
                      Accept
                    </button>
                    <button
                      disabled={busy}
                      className="button secondary"
                      onClick={() => act(c.id, 'reject')}
                    >
                      Reject
                    </button>
                  </>
                ) : (
                  <>
                    <span className="pending-label">Request Sent</span>
                    <button
                      disabled={busy}
                      className="button secondary"
                      onClick={() => act(c.id, 'cancel')}
                    >
                      Cancel Request
                    </button>
                  </>
                )}
                <button className="text-link" onClick={() => viewProfile(student)}>
                  View profile <ArrowUpRight size={14} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {!groups[tab as keyof typeof groups].length && (
        <Empty
          title={
            tab === 'accepted'
              ? 'Every circle starts with a hello.'
              : tab === 'sent'
                ? 'No requests out in the world.'
                : 'You’re all caught up.'
          }
          body={
            tab === 'accepted'
              ? 'Discover students who share your curiosity and send your first request.'
              : 'Your connection requests will appear here.'
          }
        >
          <Link className="button primary" href="/discover">
            Discover people <Compass size={16} />
          </Link>
        </Empty>
      )}
    </>
  );
}
export function EventsPage() {
  const { state, mutate, busy } = useCircle();
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
                      await mutate(`events/${event.id}`, { saved: !event.savedBy.length });
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
export function NotificationsPage() {
  const { state, mutate, navigate, busy } = useCircle();
  const [unread, setUnread] = useState(false);
  const items = state.notifications.filter((n) => !unread || !n.readAt);
  return (
    <>
      <PageHeading
        eyebrow="YOU’RE PART OF SOMETHING"
        title="A little update from your circle."
        description="New connections, fresh collaborations, and ideas that resonate."
      >
        <button
          className="button secondary"
          disabled={busy}
          onClick={async () => {
            try {
              await mutate('notifications', {}, 'PATCH');
            } catch {}
          }}
        >
          <CheckCheck size={17} />
          Mark all read
        </button>
      </PageHeading>
      <div className="tabs">
        <button className={!unread ? 'active' : ''} onClick={() => setUnread(false)}>
          All updates
        </button>
        <button className={unread ? 'active' : ''} onClick={() => setUnread(true)}>
          Unread<span>{state.notifications.filter((n) => !n.readAt).length}</span>
        </button>
      </div>
      <div className="notification-list">
        {items.map((n) => (
          <button
            className={`notification-row ${!n.readAt ? 'unread' : ''}`}
            key={n.id}
            onClick={async () => {
              try {
                await mutate(`notifications/${n.id}`, {}, 'PATCH');
                navigate(n.href);
              } catch {}
            }}
          >
            <span className="stat-icon mint">
              <Bell size={21} />
            </span>
            <div>
              <h3>{n.title}</h3>
              <p>{n.body}</p>
              <small>{relative(n.createdAt)}</small>
            </div>
            {!n.readAt && <span className="status-dot" />}
            <ArrowUpRight size={17} />
          </button>
        ))}
      </div>
      {!items.length && (
        <Empty
          title="All quiet, in a good way."
          body="We’ll let you know when something new happens in your circle."
        />
      )}
    </>
  );
}
export function ProfilePage() {
  const { state, mutate, toast } = useCircle();
  const [edit, setEdit] = useState(false);
  return (
    <>
      <PageHeading
        eyebrow="THIS IS YOUR LITTLE CORNER"
        title="Let your people find you."
        description="Your story, your skills, and the things you’re excited to make."
      >
        <button className="button primary" onClick={() => setEdit(!edit)}>
          <Pencil size={16} />
          {edit ? 'View profile' : 'Edit profile'}
        </button>
      </PageHeading>
      <div className="profile-layout">
        <section className="panel">
          {edit ? (
            <ProfileForm
              user={state.me}
              save={async (body) => {
                await mutate('profile', body, 'PATCH');
                setEdit(false);
                toast('Profile updated. Looking good!');
              }}
            />
          ) : (
            <ProfileDetails user={state.me} />
          )}
        </section>
        <aside>
          <div className="panel">
            <span className="stat-icon mint">
              <Globe size={22} />
            </span>
            <h3>Open a few more doors.</h3>
            <p className="muted">
              Add the skills you love using, the ideas that keep you curious, and the kind of team
              you want to be part of.
            </p>
            <small>
              College verification is separate from email verification and cannot be enabled by
              editing your profile.
            </small>
          </div>
          {state.blockedIds.length > 0 && (
            <div className="panel blocked-panel">
              <h3>Blocked connections</h3>
              <p className="muted">Unblock a student you blocked to allow connecting again.</p>
              {state.blockedIds.map((id) => (
                <button
                  key={id}
                  className="button secondary"
                  onClick={async () => {
                    try {
                      await mutate(`blocks/${id}`, {}, 'DELETE');
                      toast('Your block has been removed.');
                    } catch {}
                  }}
                >
                  Unblock student {id.slice(0, 8)}
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
