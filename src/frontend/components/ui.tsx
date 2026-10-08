'use client';
import { useEffect, useRef } from 'react';
import { X, BadgeCheck, ArrowUpRight, Circle } from 'lucide-react';
import type { Student } from '@/shared/contracts/responses';
import { historicalStoragePhoto } from '@/shared/config/supabase-project.mjs';
export function Avatar({
  user,
  size = 'normal',
  eager = false,
}: {
  user: Pick<Student, 'name' | 'photo'>;
  size?: 'small' | 'normal' | 'large';
  eager?: boolean;
}) {
  const color = [...user.name].reduce((s, c) => s + c.charCodeAt(0), 0) % 5;
  return (
    <span className={`avatar ${size} tone-${color}`} aria-label={user.name}>
      {user.photo && !historicalStoragePhoto(user.photo, process.env.NEXT_PUBLIC_SUPABASE_URL) ? (
        <img
          src={user.photo}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          draggable={false}
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
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  className?: string;
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
      className={`modal ${wide ? 'wide' : ''} ${className}`}
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
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {children}
    </div>
  );
}
export function Loading({ variant = 'default' }: { variant?: 'default' | 'screen' }) {
  return (
    <div className={`loading ${variant === 'screen' ? 'loading-screen' : ''}`} role="status">
      <span className="loading-mark" aria-hidden="true">
        <span className="loading-orbit" />
        <span className="loading-orbit-dot" />
        <Circle className="loading-symbol" size={26} strokeWidth={1.8} />
      </span>
      <span className="loading-label">Loading…</span>
      <span className="loading-caption" aria-hidden="true">
        Bringing your space together
      </span>
    </div>
  );
}
export type TagCategory = 'skill' | 'interest' | 'domain' | 'looking';
export function Tag({ children, category }: { children: React.ReactNode; category?: TagCategory }) {
  return <span className={`tag${category ? ` tag-${category}` : ''}`}>{children}</span>;
}
export function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a className="text-link" href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <ArrowUpRight size={14} />
    </a>
  );
}
