'use client';

import { ArrowUpRight, Plus, X, Sparkles, GraduationCap } from 'lucide-react';
import type { Student } from '@/shared/contracts/responses';

import { useCircle } from '@/frontend/state/circle-context';
import { Avatar, Tag, Verified } from '@/frontend/components/ui';

export function StudentCard({ student }: { student: Student }) {
  const { api, state, mutate, busy, viewProfile, toast, navigate } = useCircle();
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
                  await mutate(() =>
                    api.connections.update(connection.id, {
                      action: outgoing ? 'cancel' : 'accept',
                    }),
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
                if (!state.me.collegeVerified) {
                  navigate('/profile');
                  toast('Verify your college email or ID before sending connection requests.');
                  return;
                }
                try {
                  await mutate(() => api.connections.request({ userId: student.id }));
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
                  await mutate(() => api.skips.add(student.id));
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
