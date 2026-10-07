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
import { EventPoster } from '@/frontend/features/events/event-poster';
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
      <div className="home-columns">
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
                <EventPoster
                  eventId={event.id}
                  attachments={event.attachments}
                  category={event.category}
                  index={i}
                  startsAt={event.startsAt}
                />
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
        <div className="home-main">
          <div className="section-heading">
            <div>
              <h2>People to meet</h2>
            </div>
            <Link href="/discover" className="text-link">
              View all <ArrowRight size={15} />
            </Link>
          </div>
          <div
            className="horizontal-profile-tray"
            role="region"
            aria-label="People to meet"
            tabIndex={0}
          >
            {state.students.slice(0, 6).map((student) => (
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
          <div className="idea-stack">
            {state.ideas.slice(0, 3).map((idea) => (
              <IdeaCard key={idea.id} idea={idea} compact />
            ))}
          </div>
          {!state.ideas.length && (
            <div className="panel">
              <p>No ideas yet.</p>
              <Link className="text-link" href="/ideas">
                Post idea <ArrowRight size={15} />
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
