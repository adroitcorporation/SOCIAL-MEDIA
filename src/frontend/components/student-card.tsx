'use client';

import { useRef, useState } from 'react';
import { ArrowUpRight, Plus, X, Sparkles, GraduationCap } from 'lucide-react';
import type { Student } from '@/shared/contracts/responses';

import { useCircle } from '@/frontend/state/circle-context';
import { Avatar, Tag, Verified } from '@/frontend/components/ui';
import { applyConnection } from '@/frontend/state/connection-update';

export function StudentCard({
  student,
  onAfterAction,
  discoverMode = false,
}: {
  student: Student;
  onAfterAction?: () => void;
  discoverMode?: boolean;
}) {
  const { api, state, mutate, busy, viewProfile, toast, navigate } = useCircle();
  const connection = state.connections.find((c) =>
    [c.requesterId, c.receiverId].includes(student.id),
  );
  const pending = !discoverMode && connection?.status === 'PENDING';
  const outgoing = connection?.requesterId === state.me.id;
  const shared = student.interests.filter((i) => state.me.interests.includes(i));
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const finishAction = () => {
    onAfterAction?.();
  };
  const handleConnect = async () => {
    if (!state.me.collegeVerified) {
      navigate('/profile');
      toast('Verify your college email or ID before sending connection requests.');
      return;
    }
    try {
      await mutate(() => api.connections.request({ userId: student.id }), applyConnection);
      toast('Request sent. A new connection starts here.');
      finishAction();
    } catch {}
  };
  const handleSkip = async () => {
    try {
      await mutate(() => api.skips.add(student.id));
      finishAction();
    } catch {}
  };
  return (
    <article
      className={`student-card ${dragging ? 'is-dragging' : ''}`}
      onPointerDown={(event) => {
        dragStartX.current = event.clientX;
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (dragStartX.current === null) return;
        setDragX(event.clientX - dragStartX.current);
      }}
      onPointerUp={() => {
        if (dragStartX.current === null) return;
        const delta = dragX;
        dragStartX.current = null;
        setDragging(false);
        if (delta > 120) void handleConnect();
        else if (delta < -120) void handleSkip();
        setDragX(0);
      }}
      onPointerLeave={() => {
        if (!dragging) return;
        dragStartX.current = null;
        setDragging(false);
        setDragX(0);
      }}
      style={{
        transform: `translateX(${dragX}px) rotate(${dragX / 18}deg)`,
        transition: dragging ? 'none' : 'transform 0.18s ease',
      }}
    >
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
        {discoverMode ? (
          <>
            <button
              disabled={busy}
              className="button secondary connect discover-connect"
              onClick={() => void handleConnect()}
            >
              <Plus size={15} />
              Connect
            </button>
            <button
              disabled={busy}
              className="button ghost discover-pass"
              aria-label={`Pass ${student.name}`}
              onClick={() => void handleSkip()}
            >
              <X size={17} />
              Pass
            </button>
          </>
        ) : pending ? (
          <>
            <span className="pending-label">{outgoing ? 'Request Sent' : 'Wants to connect'}</span>
            <button
              disabled={busy}
              className="button small secondary"
              onClick={async () => {
                try {
                  await mutate(
                    () =>
                      api.connections.update(connection.id, {
                        action: outgoing ? 'cancel' : 'accept',
                      }),
                    applyConnection,
                  );
                  toast(outgoing ? 'Request cancelled.' : 'You’re connected!');
                  finishAction();
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
              onClick={() => void handleConnect()}
            >
              <Plus size={15} />
              Connect
            </button>
            <button
              disabled={busy}
              className="icon-button skip"
              aria-label={`Skip ${student.name}`}
              onClick={() => void handleSkip()}
            >
              <X size={17} />
            </button>
          </>
        )}
      </div>
    </article>
  );
}
