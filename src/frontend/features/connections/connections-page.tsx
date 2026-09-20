'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Plus, Check, MessageCircle, Compass } from 'lucide-react';

import type { ConnectionAction } from '@/shared/contracts/enums';
import { useCircle } from '@/frontend/state/circle-context';
import { Avatar, Empty, Tag, Verified } from '@/frontend/components/ui';

import { PageHeading } from '@/frontend/components/page-heading';
export function ConnectionsPage() {
  const { api, state, mutate, busy, viewProfile, navigate, toast } = useCircle();
  const [tab, setTab] = useState('accepted');
  const groups = {
    accepted: state.connections.filter((c) => c.status === 'ACCEPTED'),
    incoming: state.connections.filter(
      (c) => c.status === 'PENDING' && c.receiverId === state.me.id,
    ),
    sent: state.connections.filter((c) => c.status === 'PENDING' && c.requesterId === state.me.id),
  };
  async function act(id: string, action: ConnectionAction) {
    try {
      await mutate(() => api.connections.update(id, { action }));
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
                        const result = await mutate(() =>
                          api.conversations.create({
                            type: 'DIRECT',
                            userId: student.id,
                          }),
                        );
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
