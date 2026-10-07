'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Plus,
  X,
  Users,
  GraduationCap,
  UserPlus,
  LoaderCircle,
  Check,
} from 'lucide-react';
import { normalizeList } from '@/shared/recommendations/taxonomy';
import type { Student } from '@/shared/contracts/responses';

import { useCircle } from '@/frontend/state/circle-context';
import { Avatar, Tag, Verified } from '@/frontend/components/ui';
import {
  lockSwipeDirection,
  completesSwipe,
  type SwipeDirection,
} from '@/frontend/utils/swipe-gesture';
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
  const { api, state, mutate, busy, viewProfile, requestConnection, toast, navigate } = useCircle();
  const connection = state.connections.find(
    (c) =>
      [c.requesterId, c.receiverId].includes(student.id) &&
      ['PENDING', 'ACCEPTED'].includes(c.status),
  );
  const pending = connection?.status === 'PENDING';
  const accepted = connection?.status === 'ACCEPTED';
  const blocked = state.blockedIds.includes(student.id);
  const [sending, setSending] = useState(false);
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
  const dragStartY = useRef(0);
  const dragDirection = useRef<SwipeDirection>('pending');
  const dragWidth = useRef(0);
  const dragPointerId = useRef<number | null>(null);
  const dragX = useRef(0);
  const dragVelocity = useRef(0);
  const lastPointerSample = useRef<{ x: number; time: number } | null>(null);
  const actionInFlight = useRef(false);
  useEffect(() => {
    const card = cardRef.current;
    if (!discoverMode || preview || !card) return;
    // React delegates touch listeners passively. Cancel only a locked horizontal gesture.
    const move = (event: TouchEvent) => {
      if (dragStartX.current === null || event.touches.length !== 1) return;
      const touch = event.touches[0];
      dragDirection.current = lockSwipeDirection(
        dragDirection.current,
        touch.clientX - dragStartX.current,
        touch.clientY - dragStartY.current,
      );
      if (dragDirection.current === 'horizontal' && event.cancelable) event.preventDefault();
    };
    card.addEventListener('touchmove', move, { passive: false });
    return () => card.removeEventListener('touchmove', move);
  }, [discoverMode, preview]);

  const resetDrag = (card: HTMLElement) => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    dragStartX.current = null;
    const pointerId = dragPointerId.current;
    dragPointerId.current = null;
    dragDirection.current = 'pending';
    if (pointerId !== null && card.hasPointerCapture(pointerId))
      card.releasePointerCapture(pointerId);
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
  const handleConnect = async (advance = false) => {
    if (preview || busy || actionInFlight.current) return;
    if (blocked || accepted || (pending && outgoing)) {
      recoverCard();
      return;
    }
    if (pending) {
      recoverCard();
      navigate('/connections');
      return;
    }
    actionInFlight.current = true;
    setSending(true);
    try {
      if (await requestConnection(student)) {
        if (advance) {
          await exitCard(1);
          finishAction();
        } else recoverCard();
      } else recoverCard();
    } finally {
      actionInFlight.current = false;
      if (mounted.current) setSending(false);
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
        if ((event.target as HTMLElement).closest('input, select, textarea')) return;
        if (busy || actionInFlight.current || !event.isPrimary || event.button !== 0) return;
        dragStartX.current = event.clientX;
        dragStartY.current = event.clientY;
        dragDirection.current = 'pending';
        dragWidth.current = event.currentTarget.offsetWidth;
        dragPointerId.current = event.pointerId;
        dragX.current = 0;
        dragVelocity.current = 0;
        lastPointerSample.current = { x: event.clientX, time: event.timeStamp };
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
        dragDirection.current = lockSwipeDirection(
          dragDirection.current,
          delta,
          event.clientY - dragStartY.current,
        );
        if (dragDirection.current !== 'horizontal') return;
        if (!event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.classList.add('is-dragging');
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
        const elapsed = lastPointerSample.current
          ? event.timeStamp - lastPointerSample.current.time
          : Infinity;
        const velocity = elapsed < 100 ? dragVelocity.current : 0;
        const horizontal = dragDirection.current === 'horizontal';
        const width = dragWidth.current;
        const pointerId = dragPointerId.current;
        dragStartX.current = null;
        dragPointerId.current = null;
        if (pointerId !== null && event.currentTarget.hasPointerCapture(pointerId))
          event.currentTarget.releasePointerCapture(pointerId);
        if (horizontal && completesSwipe(delta, velocity, width)) {
          if (delta > 0) void handleConnect(true);
          else void handleSkip();
        } else resetDrag(event.currentTarget);
        if (busy) resetDrag(event.currentTarget);
      }}
      onPointerCancel={(event) => {
        homePointer.current = null;
        if (event.pointerId === dragPointerId.current) resetDrag(event.currentTarget);
      }}
      onLostPointerCapture={(event) => {
        if (
          event.target === event.currentTarget &&
          dragStartX.current !== null &&
          event.pointerId === dragPointerId.current
        )
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
          <div className="tags discover-interests">
            {student.interests.slice(0, 2).map((interest) => (
              <Tag key={interest} category="interest">
                {interest}
              </Tag>
            ))}
          </div>
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
              <Tag key={skill} category="skill">
                {skill}
              </Tag>
            ))}
          </div>
          {lookingLabel && (
            <div className="looking">
              <span className="status-dot" />
              Looking for: <Tag category="looking">{lookingLabel}</Tag>
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
              <Tag key={skill} category="skill">
                {skill}
              </Tag>
            ))}
          </div>
          {lookingLabel && (
            <div className="looking">
              <span className="status-dot" />
              Looking for: <Tag category="looking">{lookingLabel}</Tag>
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
              disabled={busy || sending}
              className="button ghost discover-pass"
              aria-label={`Skip ${student.name}`}
              title="Skip"
              onClick={() => void handleSkip()}
            >
              <X size={21} /> Skip
            </button>
            {!blocked && (
              <button
                disabled={busy || sending || accepted || Boolean(pending && outgoing)}
                aria-busy={sending}
                className="button secondary connect discover-connect"
                onClick={() => void handleConnect()}
              >
                {sending ? (
                  <LoaderCircle className="connection-spinner" size={18} />
                ) : accepted ? (
                  <Check size={18} />
                ) : (
                  <UserPlus size={18} />
                )}
                {sending
                  ? 'Connecting...'
                  : accepted
                    ? 'Connected'
                    : pending
                      ? outgoing
                        ? 'Pending'
                        : 'Respond'
                      : 'Connect'}
              </button>
            )}
          </>
        ) : accepted || blocked ? (
          <span className="pending-label">{blocked ? 'Blocked' : 'Connected'}</span>
        ) : pending ? (
          <>
            <span className="pending-label">{outgoing ? 'Request Sent' : 'Wants to connect'}</span>
            <button
              disabled={busy || sending}
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
              {sending ? (
                <LoaderCircle className="connection-spinner" size={15} />
              ) : (
                <Plus size={15} />
              )}
              {sending ? 'Connecting...' : 'Connect'}
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
