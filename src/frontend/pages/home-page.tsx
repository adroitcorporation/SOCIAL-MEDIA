'use client';

import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Users,
  Lightbulb,
  CalendarDays,
  MapPin,
  PenTool,
} from 'lucide-react';

import { useCircle } from '@/frontend/state/circle-context';
import { Empty } from '@/frontend/components/ui';

import { IdeaCard } from '@/frontend/features/ideas/ideas-page';
import { PageHeading } from '@/frontend/components/page-heading';
import { StudentCard } from '@/frontend/components/student-card';
export function HomePage() {
  const { state } = useCircle();
  const accepted = state.connections.filter((c) => c.status === 'ACCEPTED');
  const incoming = state.connections.filter(
    (c) => c.status === 'PENDING' && c.receiverId === state.me.id,
  );
  return (
    <>
      <PageHeading title={`Hey ${state.me.name.split(' ')[0]}`} />
      <section className="hero">
        <div className="hero-copy">
          <h2>
            Meet your next
            <br />
            <em>collaborator.</em>
          </h2>
          <Link href="/discover" className="button dark">
            Discover people <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <div className="orbit-core">
            <Users size={46} />
          </div>
          <div className="orbit-chip chip-design">
            <PenTool size={18} /> design
          </div>
          <div className="orbit-chip chip-build">
            <span>⌘</span> build
          </div>
          <div className="orbit-chip chip-create">
            <span>↗</span> create
          </div>
          <div className="orbit-person person-one">A</div>
          <div className="orbit-person person-two">R</div>
        </div>
      </section>
      <div className="stats-row">
        {[
          {
            icon: Users,
            value: accepted.length,
            label: 'Your connections',
            note: incoming.length ? `${incoming.length} requests` : '',
            href: '/connections',
            color: 'mint',
          },
          {
            icon: Lightbulb,
            value: state.ideas.length,
            label: 'Ideas to explore',
            note: '',
            href: '/ideas',
            color: 'peach',
          },
          {
            icon: CalendarDays,
            value: state.events.length,
            label: 'Upcoming events',
            note: '',
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
              {stat.note && <p>{stat.note}</p>}
            </div>
            <ArrowUpRight size={18} />
          </Link>
        ))}
      </div>
      <div className="home-columns">
        <div className="home-main">
          <div className="section-heading">
            <div>
              <h2>People to meet</h2>
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
          {!state.students.length && <Empty title="No people yet." />}
          <div className="section-heading ideas-section-heading">
            <div>
              <h2>Ideas</h2>
            </div>
            <Link href="/ideas" className="text-link">
              Idea Board <ArrowRight size={15} />
            </Link>
          </div>
          {state.ideas.slice(0, 2).map((idea) => (
            <IdeaCard key={idea.id} idea={idea} compact />
          ))}
          {!state.ideas.length && (
            <div className="panel">
              <p>No ideas yet.</p>
              <Link className="text-link" href="/ideas">
                Post idea <ArrowRight size={15} />
              </Link>
            </div>
          )}
        </div>
        <aside className="home-right">
          <div className="section-heading">
            <h2>Events</h2>
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
              <p>No upcoming events.</p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
