'use client';

import { useState } from 'react';

import { Pencil, Globe } from 'lucide-react';

import { useCircle } from '@/frontend/state/circle-context';

import { ProfileDetails, ProfileForm } from '@/frontend/features/profile/profile-form';

import { PageHeading } from '@/frontend/components/page-heading';
export function ProfilePage() {
  const { api, state, mutate, toast } = useCircle();
  const [edit, setEdit] = useState(false);
  return (
    <>
      <PageHeading
        eyebrow="THIS IS YOUR LITTLE CORNER"
        title="Let your people find you."
        description="Your story, your skills, and the things you’re excited to make."
      >
        <button className="button primary" onClick={() => setEdit(!edit)}>
          <Pencil size={16} />
          {edit ? 'View profile' : 'Edit profile'}
        </button>
      </PageHeading>
      <div className="profile-layout">
        <section className="panel">
          {edit ? (
            <ProfileForm
              user={state.me}
              save={async (body) => {
                await mutate(() => api.profiles.update(body));
                setEdit(false);
                toast('Profile updated. Looking good!');
              }}
            />
          ) : (
            <ProfileDetails user={state.me} />
          )}
        </section>
        <aside>
          <div className="panel">
            <span className="stat-icon mint">
              <Globe size={22} />
            </span>
            <h3>Open a few more doors.</h3>
            <p className="muted">
              Add the skills you love using, the ideas that keep you curious, and the kind of team
              you want to be part of.
            </p>
            <small>
              College verification is separate from email verification and cannot be enabled by
              editing your profile.
            </small>
          </div>
          {state.blockedIds.length > 0 && (
            <div className="panel blocked-panel">
              <h3>Blocked connections</h3>
              <p className="muted">Unblock a student you blocked to allow connecting again.</p>
              {state.blockedIds.map((id) => (
                <button
                  key={id}
                  className="button secondary"
                  onClick={async () => {
                    try {
                      await mutate(() => api.blocks.remove(id));
                      toast('Your block has been removed.');
                    } catch {}
                  }}
                >
                  Unblock student {id.slice(0, 8)}
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
