'use client';

import { useEffect, useMemo, useRef } from 'react';
import { ArrowUpRight, Plus, X, Users, GraduationCap, Handshake } from 'lucide-react';
import { normalizeList } from '@/shared/recommendations/taxonomy';
import type { Student } from '@/shared/contracts/responses';

import { useCircle } from '@/frontend/state/circle-context';
import { Avatar, Tag, Verified } from '@/frontend/components/ui';
import { applyConnection } from '@/frontend/state/connection-update';

export function cardSwipeEnabled(discoverMode: boolean) {
  return discoverMode;
}

export function StudentCard({
  student,
  onAfterAction,
  discoverMode = false,
  preview = false,
}: {
  student: Student;
  onAfterAction?: (studentId: string) => void;
  discoverMode?: boolean;
  preview?: boolean;
}) {
  const { api, state, mutate, busy, viewProfile, requestConnection, toast } = useCircle();
  const connection = state.connections.find((c) =>
    [c.requesterId, c.receiverId].includes(student.id),
  );
  const pending = !discoverMode && connection?.status === 'PENDING';
  const outgoing = connection?.requesterId === state.me.id;
  const shared = student.interests.filter((i) => state.me.interests.includes(i));
  const quickSkills = useMemo(
    () => normalizeList('skills', student.skills).slice(0, 3),
    [student.skills],
  );
  const lookingLabel = useMemo(
    () => normalizeList('lookingFor', student.lookingFor)[0],
    [student.lookingFor],
  );
  const cardRef = useRef<HTMLElement>(null);
  const frame = useRef<number | null>(null);
  const mounted = useRef(true);
  const homePointer = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);
  const paintDrag = (card: HTMLElement) => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      card.style.setProperty('--drag-x', `${dragX.current}px`);
      card.style.setProperty(
        '--drag-rotation',
        `${Math.max(-12, Math.min(12, dragX.current / 24))}deg`,
      );
    });
  };
  const dragStartX = useRef<number | null>(null);
  const dragPointerId = useRef<number | null>(null);
  const dragX = useRef(0);
  const dragVelocity = useRef(0);
  const lastPointerSample = useRef<{ x: number; time: number } | null>(null);
  const actionInFlight = useRef(false);
  const resetDrag = (card: HTMLElement) => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    dragStartX.current = null;
    dragPointerId.current = null;
    dragX.current = 0;
    dragVelocity.current = 0;
    lastPointerSample.current = null;
    card.style.setProperty('--drag-x', '0px');
    card.style.setProperty('--drag-rotation', '0deg');
    card.classList.remove('is-dragging', 'is-exiting');
  };
  const finishAction = () => {
    if (mounted.current) onAfterAction?.(student.id);
  };
  const exitCard = (direction: number) => {
    const card = cardRef.current;
    if (!discoverMode || !card) return Promise.resolve();
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    card.classList.remove('is-dragging');
    card.classList.add('is-exiting');
    card.style.setProperty('--drag-x', `${direction * (card.offsetWidth + 80)}px`);
    card.style.setProperty('--drag-rotation', `${direction * 10}deg`);
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;
    return new Promise<void>((resolve) => setTimeout(resolve, duration));
  };
  const recoverCard = () => {
    if (mounted.current && cardRef.current) resetDrag(cardRef.current);
  };
  const handleConnect = async () => {
    if (preview || busy || actionInFlight.current) return;
    actionInFlight.current = true;
    try {
      if (await requestConnection(student, () => exitCard(1))) finishAction();
      else recoverCard();
    } finally {
      actionInFlight.current = false;
    }
  };
  const handleSkip = async () => {
    if (preview || busy || actionInFlight.current) return;
    actionInFlight.current = true;
    try {
      await mutate(
        async () => {
          const [result] = await Promise.all([api.skips.add(student.id), exitCard(-1)]);
          return result;
        },
        (current) => ({
          ...current,
          students: current.students.filter((candidate) => candidate.id !== student.id),
          totalStudents: Math.max(0, current.totalStudents - 1),
        }),
      );
      finishAction();
    } catch {
      recoverCard();
    } finally {
      actionInFlight.current = false;
    }
  };
  return (
    <article
      ref={cardRef}
      className={`student-card ${discoverMode ? 'discover-profile-card' : ''} ${preview ? 'is-preview' : ''}`}
      inert={preview}
      aria-hidden={preview || undefined}
      onClickCapture={(event) => {
        if (suppressClick.current) {
          event.preventDefault();
          event.stopPropagation();
          suppressClick.current = false;
        }
      }}
      onClick={(event) => {
        if (
          !discoverMode &&
          !(event.target as HTMLElement).closest('button, a, input, select, textarea')
        )
          viewProfile(student);
      }}
      onPointerDown={(event) => {
        if (preview) return;
        suppressClick.current = false;
        if (!cardSwipeEnabled(discoverMode)) {
          homePointer.current = { x: event.clientX, y: event.clientY };
          return;
        }
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
        if (!cardSwipeEnabled(discoverMode)) {
          const start = homePointer.current;
          if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8)
            suppressClick.current = true;
          return;
        }
        if (dragStartX.current === null || event.pointerId !== dragPointerId.current) return;
        const delta = event.clientX - dragStartX.current;
        const previous = lastPointerSample.current;
        const elapsed = previous ? event.timeStamp - previous.time : 0;
        if (previous && elapsed > 0) dragVelocity.current = (event.clientX - previous.x) / elapsed;
        dragX.current = delta;
        if (Math.abs(delta) > 8) suppressClick.current = true;
        lastPointerSample.current = { x: event.clientX, time: event.timeStamp };
        paintDrag(event.currentTarget);
      }}
      onPointerUp={(event) => {
        if (!cardSwipeEnabled(discoverMode)) {
          homePointer.current = null;
          return;
        }
        if (dragStartX.current === null || event.pointerId !== dragPointerId.current) return;
        const delta = event.clientX - dragStartX.current;
        const velocity = dragVelocity.current;
        const threshold = Math.min(120, event.currentTarget.offsetWidth * 0.28);
        dragStartX.current = null;
        dragPointerId.current = null;
        if (delta > threshold || (delta > 45 && velocity > 0.55)) void handleConnect();
        else if (delta < -threshold || (delta < -45 && velocity < -0.55)) void handleSkip();
        else resetDrag(event.currentTarget);
        if ((delta > 0 && !state.me.collegeVerified) || busy) resetDrag(event.currentTarget);
      }}
      onPointerCancel={(event) => {
        homePointer.current = null;
        if (event.pointerId === dragPointerId.current) resetDrag(event.currentTarget);
      }}
      onLostPointerCapture={(event) => {
        if (dragStartX.current !== null && event.pointerId === dragPointerId.current)
          resetDrag(event.currentTarget);
      }}
    >
      <div className={`student-top ${discoverMode ? 'discover-cover' : ''}`}>
        <Avatar user={student} size="large" eager={discoverMode} />
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
          {student.matchScore !== undefined && (
            <div className="match-summary">
              <span className="match-score">{student.matchScore}% Match</span>
              {Boolean(student.reasons?.length) && (
                <div className="tags">
                  {student.reasons!.slice(0, 3).map((reason) => (
                    <Tag key={reason}>{reason}</Tag>
                  ))}
                </div>
              )}
            </div>
          )}
          <p className="college">
            <GraduationCap size={15} />
            {student.college}
          </p>

          {!student.reasons?.length && shared.length > 0 && (
            <div className="discover-common">
              <Users size={15} />
              <span>{shared[0]} in common</span>
            </div>
          )}

          <div className="tags">
            {quickSkills.map((skill) => (
              <Tag key={skill}>{skill}</Tag>
            ))}
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
