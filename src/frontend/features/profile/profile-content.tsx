'use client';
import { useState } from 'react';
import type { Student } from '@/shared/contracts/responses';
import { ProfileDetails } from './profile-form';
import { ProfilePosts } from '@/frontend/features/posts/profile-posts';

export function ProfileContent({
  user,
  onOpenPost,
  initialSection = 'About',
}: {
  user: Student;
  onOpenPost?: () => void;
  initialSection?: 'About' | 'Posts';
}) {
  const [section, setSection] = useState<'About' | 'Posts'>(initialSection);
  return (
    <div>
      <nav className="profile-sections" aria-label="Profile sections">
        {(['About', 'Posts'] as const).map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={section === name}
            onClick={() => setSection(name)}
          >
            {name}
          </button>
        ))}
      </nav>
      {section === 'About' ? (
        <ProfileDetails user={user} />
      ) : (
        <ProfilePosts key={user.id} authorId={user.id} onOpen={onOpenPost} />
      )}
    </div>
  );
}
