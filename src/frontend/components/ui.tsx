'use client';
import { useEffect, useRef } from 'react';
import { X, BadgeCheck, ArrowUpRight, LoaderCircle } from 'lucide-react';
import type { Student } from '@/shared/contracts/responses';
export function Avatar({
  user,
  size = 'normal',
}: {
  user: Pick<Student, 'name' | 'photo'>;
  size?: 'small' | 'normal' | 'large';
}) {
  const color = [...user.name].reduce((s, c) => s + c.charCodeAt(0), 0) % 5;
  return (
    <span className={`avatar ${size} tone-${color}`} aria-label={user.name}>
      {user.photo ? (
        <img
          src={user.photo}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : null}
      <span>
        {user.name
          .split(' ')
          .slice(0, 2)
          .map((n) => n[0])
          .join('')}
      </span>
    </span>
  );
}
export function Verified({ user }: { user: Pick<Student, 'collegeVerified' | 'emailVerified'> }) {
  return user.collegeVerified ? (
    <BadgeCheck size={16} className="verified" aria-label="College verified" />
  ) : user.emailVerified ? (
    <span className="email-badge" title="Email verified; college verification pending">
      Email verified
    </span>
  ) : null;
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-head">
        <h2 id="modal-title">{title}</h2>
        <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Empty({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-orbit">✳</span>
      <h3>{title}</h3>
      <p>{body}</p>
      {children}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={24} />
      <span>Finding your circle…</span>
    </div>
  );
}
export function Tag({ children }: { children: React.ReactNode }) {
  return <span className="tag">{children}</span>;
}
export function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a className="text-link" href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <ArrowUpRight size={14} />
    </a>
  );
}
