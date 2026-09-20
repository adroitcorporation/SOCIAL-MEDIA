'use client';

import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Users, Lightbulb, CalendarDays, MapPin } from 'lucide-react';

import { useCircle } from '@/frontend/state/circle-context';
import { Avatar, Empty } from '@/frontend/components/ui';

import { IdeaCard } from '@/frontend/features/ideas/ideas-page';
import { PageHeading } from '@/frontend/components/page-heading';
import { StudentCard } from '@/frontend/components/student-card';
export function HomePage() {
  const { api, state } = useCircle();
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
