'use client';

import { useRef } from 'react';
import { ArrowUpRight, Plus, X, Users, GraduationCap, Handshake } from 'lucide-react';
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
  onAfterAction?: (studentId: string) => void;
  discoverMode?: boolean;
}) {
  const { api, state, mutate, busy, viewProfile, toast, navigate } = useCircle();
  const connection = state.connections.find((c) =>
    [c.requesterId, c.receiverId].includes(student.id),
  );
  const pending = !discoverMode && connection?.status === 'PENDING';
  const outgoing = connection?.requesterId === state.me.id;
  const shared = student.interests.filter((i) => state.me.interests.includes(i));
  const quickSkills = student.skills.slice(0, 2);
  const lookingLabel = student.lookingFor[0];
  const dragStartX = useRef<number | null>(null);
  const dragPointerId = useRef<number | null>(null);
  const dragX = useRef(0);
  const dragVelocity = useRef(0);
  const lastPointerSample = useRef<{ x: number; time: number } | null>(null);
  const actionInFlight = useRef(false);
  const resetDrag = (card: HTMLElement) => {
    dragStartX.current = null;
    dragPointerId.current = null;
    dragX.current = 0;
    dragVelocity.current = 0;
    lastPointerSample.current = null;
    card.style.setProperty('--drag-x', '0px');
    card.style.setProperty('--drag-rotation', '0deg');
    card.classList.remove('is-dragging');
  };
  const finishAction = () => {
    onAfterAction?.(student.id);
  };
  const handleConnect = async () => {
    if (busy || actionInFlight.current) return;
    if (!state.me.collegeVerified) {
      navigate('/profile');
      toast('Verify your college email or ID before sending connection requests.');
      return;
    }
    actionInFlight.current = true;
    try {
      await mutate(() => api.connections.request({ userId: student.id }), applyConnection);
      toast('Request sent.');
      finishAction();
    } catch {
    } finally {
      actionInFlight.current = false;
    }
  };
  const handleSkip = async () => {
    if (busy || actionInFlight.current) return;
    actionInFlight.current = true;
    try {
      await mutate(
        () => api.skips.add(student.id),
        (current) => ({
          ...current,
          students: current.students.filter((candidate) => candidate.id !== student.id),
          totalStudents: Math.max(0, current.totalStudents - 1),
        }),
      );
      finishAction();
    } catch {
    } finally {
      actionInFlight.current = false;
    }
  };
  return (
    <article
      className={`student-card ${discoverMode ? 'discover-profile-card' : ''}`}
      onPointerDown={(event) => {
        // Capturing a button's pointer retargets its click to the card.
        if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return;
        if (busy || actionInFlight.current || !event.isPrimary || event.button !== 0) return;
        dragStartX.current = event.clientX;
        dragPointerId.current = event.pointerId;
        dragX.current = 0;
        dragVelocity.current = 0;
        lastPointerSample.current = { x: event.clientX, time: event.timeStamp };
        event.currentTarget.classList.add('is-dragging');
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (dragStartX.current === null || event.pointerId !== dragPointerId.current) return;
        const delta = event.clientX - dragStartX.current;
        const previous = lastPointerSample.current;
        const elapsed = previous ? event.timeStamp - previous.time : 0;
        if (previous && elapsed > 0) {
          dragVelocity.current = (event.clientX - previous.x) / elapsed;
        }
        dragX.current = delta;
        lastPointerSample.current = { x: event.clientX, time: event.timeStamp };
        event.currentTarget.style.setProperty('--drag-x', `${delta}px`);
        event.currentTarget.style.setProperty('--drag-rotation', `${delta / 24}deg`);
      }}
      onPointerUp={(event) => {
        if (dragStartX.current === null || event.pointerId !== dragPointerId.current) return;
        const delta = event.clientX - dragStartX.current;
        const velocity = dragVelocity.current;
        resetDrag(event.currentTarget);
        if (delta > 120 || (delta > 45 && velocity > 0.55)) void handleConnect();
        else if (delta < -120 || (delta < -45 && velocity < -0.55)) void handleSkip();
      }}
      onPointerCancel={(event) => {
        if (event.pointerId === dragPointerId.current) resetDrag(event.currentTarget);
      }}
    >
      <div className={`student-top ${discoverMode ? 'discover-cover' : ''}`}>
        <Avatar user={student} size="large" />
        <button
          className="icon-button"
          aria-label={`View ${student.name}'s profile`}
          onClick={() => viewProfile(student)}
        >
          <ArrowUpRight size={19} />
        </button>
        {discoverMode && (
          <div className="discover-cover-copy">
            <button className="student-name" onClick={() => viewProfile(student)}>
              {student.name}
              <Verified user={student} />
            </button>
            <p className="student-degree">
              {student.degree} <span>· {student.graduationYear}</span>
            </p>
          </div>
        )}
      </div>
      {discoverMode ? (
        <div className="discover-details">
          <p className="college">
            <GraduationCap size={15} />
            {student.college}
          </p>

          {shared.length > 0 && (
            <div className="discover-common">
              <Users size={15} />
              <span>{shared[0]} in common</span>
            </div>
          )}

          <div className="tags">
            {quickSkills.map((skill) => (
              <Tag key={skill}>{skill}</Tag>
            ))}
            {student.skills.length > 2 && <Tag>+{student.skills.length - 2}</Tag>}
          </div>
          {lookingLabel && (
            <div className="looking">
              <span className="status-dot" />
              Looking for: <span>{lookingLabel}</span>
            </div>
          )}
        </div>
      ) : (
        <>
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

          <div className="tags">
            {quickSkills.map((skill) => (
              <Tag key={skill}>{skill}</Tag>
            ))}
            {student.skills.length > 2 && <Tag>+{student.skills.length - 2}</Tag>}
          </div>
          {lookingLabel && (
            <div className="looking">
              <span className="status-dot" />
              Looking for: {lookingLabel}
            </div>
          )}
          {shared.length > 0 && (
            <div className="shared">
              <Users size={12} />
              {shared.length} shared interest{shared.length === 1 ? '' : 's'}
            </div>
          )}
        </>
      )}
      <div className="student-actions discover-actions">
        {discoverMode ? (
          <>
            <button
              disabled={busy}
              className="button ghost discover-pass"
              aria-label={`Skip ${student.name}`}
              title="Skip"
              onClick={() => void handleSkip()}
            >
              <X size={21} /> Skip
            </button>
            <button
              disabled={busy}
              className="button secondary connect discover-connect"
              onClick={() => void handleConnect()}
            >
              <span className="discover-connect-symbol" aria-hidden="true">
                <Handshake size={21} strokeWidth={2.5} />
              </span>
              Connect
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
