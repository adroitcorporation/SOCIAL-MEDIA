'use client';

import { useEffect, useState } from 'react';
import { useCircle } from '@/frontend/state/circle-context';
import { Avatar, Loading, Verified } from '@/frontend/components/ui';
import { ReportUser } from '@/frontend/features/moderation/report-user';
import { ProfileContent } from './profile-content';
import { profileHandle } from '@/frontend/utils/profile-path';
import type { Student } from '@/shared/contracts/responses';

export function UserProfilePage({ userId }: { userId: string }) {
  const { api, state, mutate, toast, navigate } = useCircle();
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

  return (
    <div className="user-profile-page">
      <header className="panel user-profile-header">
        <Avatar user={user} size="large" />
        <div className="user-profile-identity">
          <p className="user-profile-handle">u/{profileHandle(user.name)}</p>
          <h1>
            {user.name} <Verified user={user} />
          </h1>
          <p className="muted">
            {user.degree} · {user.college}
          </p>
          <p className="muted">{user.city}</p>
        </div>
      </header>

      <div className="user-profile-columns">
        <section className="panel user-profile-posts">
          <ProfileContent key={user.id} user={user} initialSection="Posts" />
        </section>
        {user.id !== state.me.id && (
          <aside className="panel user-profile-actions" aria-label="Profile actions">
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
