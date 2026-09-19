'use client';
import { useState } from 'react';
import type { Student } from '@/lib/types';
import { Avatar, Verified, Tag, ExternalLink } from './ui';
type Save = (body: unknown) => Promise<void>;
const listFields = ['skills', 'interests', 'domains', 'lookingFor'] as const;
export function ProfileForm({ user, save }: { user: Student; save: Save }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const data: Record<string, unknown> = Object.fromEntries(form);
    data.graduationYear = Number(data.graduationYear);
    for (const key of listFields)
      data[key] = String(data[key])
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    try {
      await save(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save profile.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="profile-form">
      <p className="muted">
        A little about you helps the right people find you. Separate skills and interests with
        commas.
      </p>
      <div className="form-grid">
        {[
          ['name', 'Full name', 'text', true],
          ['college', 'College', 'text', true],
          ['degree', 'Degree / course', 'text', true],
          ['graduationYear', 'Graduation year', 'number', true],
          ['city', 'City', 'text', true],
          ['photo', 'Profile photo URL (HTTPS)', 'url', false],
        ].map(([key, label, type, required]) => (
          <label key={String(key)}>
            {label}
            <input
              name={String(key)}
              type={String(type)}
              defaultValue={String(user[key as keyof Student] ?? '')}
              required={Boolean(required)}
              min={type === 'number' ? 2020 : undefined}
              max={type === 'number' ? 2040 : undefined}
              maxLength={type === 'url' ? 2048 : 150}
            />
          </label>
        ))}
      </div>
      <label>
        Bio
        <textarea
          name="bio"
          defaultValue={user.bio}
          maxLength={1000}
          rows={3}
          placeholder="What are you excited to work on?"
        />
      </label>
      <div className="form-grid">
        {listFields.map((key) => (
          <label key={key}>
            {key === 'lookingFor' ? 'Looking for' : key[0].toUpperCase() + key.slice(1)}
            <input
              name={key}
              defaultValue={user[key].join(', ')}
              placeholder={
                key === 'skills'
                  ? 'React, Figma, Python'
                  : key === 'lookingFor'
                    ? 'Hackathon teammates, Project partners'
                    : 'Design, Technology, Social impact'
              }
              maxLength={1000}
            />
          </label>
        ))}
        {(['linkedin', 'github', 'instagram', 'portfolio'] as const).map((key) => (
          <label key={key}>
            {key[0].toUpperCase() + key.slice(1)} (optional)
            <input
              name={key}
              type="url"
              defaultValue={user[key]}
              placeholder="https://"
              maxLength={2048}
            />
          </label>
        ))}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary" disabled={busy}>
        {busy ? 'Saving…' : user.onboarded ? 'Save profile' : 'Find my circle'}
      </button>
    </form>
  );
}
export function ProfileDetails({ user }: { user: Student }) {
  return (
    <div className="profile-details">
      <Avatar user={user} size="large" />
      <h2>
        {user.name} <Verified user={user} />
      </h2>
      <p>
        {user.degree} · Class of {user.graduationYear}
      </p>
      <p className="muted">
        {user.college} · {user.city}
      </p>
      <p className="bio">{user.bio || 'This student is still writing their story.'}</p>
      {listFields.map((key) => (
        <section key={key}>
          <h4>{key === 'lookingFor' ? 'Looking for' : key[0].toUpperCase() + key.slice(1)}</h4>
          <div className="tags">
            {user[key].length ? (
              user[key].map((s) => <Tag key={s}>{s}</Tag>)
            ) : (
              <span className="muted">Not added yet</span>
            )}
          </div>
        </section>
      ))}
      <div className="profile-links">
        {(['linkedin', 'github', 'instagram', 'portfolio'] as const)
          .filter((key) => user[key])
          .map((key) => (
            <ExternalLink key={key} href={user[key]}>
              {key}
            </ExternalLink>
          ))}
      </div>
      <small className="muted">
        {user.collegeVerified
          ? 'College affiliation has been verified.'
          : 'College affiliation is self-reported. Email verification does not verify college enrollment.'}
      </small>
    </div>
  );
}
