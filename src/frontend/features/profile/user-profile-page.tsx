'use client';

import { useEffect, useState } from 'react';
import { useCircle } from '@/frontend/state/circle-context';
import { Avatar, Loading, Verified } from '@/frontend/components/ui';
import { ReportUser } from '@/frontend/features/moderation/report-user';
import { ProfileContent } from './profile-content';
import { profileHandle } from '@/frontend/utils/profile-path';
import type { Student } from '@/shared/contracts/responses';

export function UserProfilePage({ userId }: { userId: string }) {
  const { api, state, mutate, toast, navigate, requestConnection, busy } = useCircle();
  const [user, setUser] = useState<Student | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setUser(null);
    setError('');
    api.profiles
      .get(userId)
      .then((profile) => {
        if (active) setUser(profile);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load profile.');
      });
    return () => {
      active = false;
    };
  }, [api, userId, retry]);

  if (error)
    return (
      <section className="panel user-profile-error" role="alert">
        <h1>Unable to load profile</h1>
        <p className="error">{error}</p>
        <button className="button secondary" onClick={() => setRetry((value) => value + 1)}>
          Try again
        </button>
      </section>
    );
  if (!user) return <Loading />;
  const accent = [...user.id].reduce((total, char) => total + char.charCodeAt(0), 0) % 6;
  const connection = state.connections.find(
    (item) =>
      [item.requesterId, item.receiverId].includes(user.id) &&
      ['PENDING', 'ACCEPTED'].includes(item.status),
  );

  return (
    <div className={`user-profile-page profile-accent-${accent}`}>
      <header className="panel user-profile-header">
        <div className="user-profile-cover" aria-hidden="true" />
        <div className="user-profile-hero">
          <Avatar user={user} size="large" />
          <div className="user-profile-identity">
            <p className="user-profile-handle">u/{profileHandle(user.name)}</p>
            <h1>
              {user.name} <Verified user={user} />
            </h1>
            <p className="user-profile-school">
              {user.degree} <span>·</span> {user.college}
              {user.city && (
                <>
                  <span>·</span> {user.city}
                </>
              )}
            </p>
            <div className="user-profile-highlights" aria-label="Profile highlights">
              <span>
                <strong>{user.skills.length}</strong> skills
              </span>
              <span>
                <strong>{user.interests.length}</strong> interests
              </span>
              <span>
                Class of <strong>{user.graduationYear}</strong>
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="user-profile-columns">
        <section className="panel user-profile-posts">
          <ProfileContent key={user.id} user={user} initialSection="Posts" compactDetails />
        </section>
        {user.id !== state.me.id && (
          <aside className="panel user-profile-actions" aria-label="Profile actions">
            <button
              className="button primary"
              disabled={busy || Boolean(connection)}
              onClick={() => void requestConnection(user)}
            >
              {connection?.status === 'ACCEPTED'
                ? 'Connected'
                : connection
                  ? 'Request pending'
                  : 'Connect'}
            </button>
            <ReportUser userId={user.id} />
            <button
              className="text-link danger"
              onClick={async () => {
                try {
                  await mutate(() => api.blocks.add(user.id));
                  toast('Student blocked. You can undo this from your profile.');
                  navigate('/');
                } catch (cause) {
                  toast(
                    cause instanceof Error ? cause.message : 'Could not block this student.',
                    true,
                  );
                }
              }}
            >
              Block student
            </button>
          </aside>
        )}
      </div>
    </div>
  );
}
