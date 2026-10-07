'use client';
import { Check, X } from 'lucide-react';
import { Modal } from './ui';
import { profileRequirements } from '@/shared/contracts/profile-completion';

export function ProfileCompletionPrompt({
  missingFields,
  close,
  edit,
}: {
  missingFields: string[];
  close: () => void;
  edit: () => void;
}) {
  return (
    <Modal title="Complete your profile to connect" onClose={close}>
      <p className="muted">
        Add a few details about yourself before sending connection requests. It helps other students
        understand who they’re connecting with.
      </p>
      <ul className="profile-requirements">
        {profileRequirements.map(({ field, label }) => {
          const missing = missingFields.includes(field);
          return (
            <li key={field}>
              {missing ? (
                <X size={18} aria-hidden="true" />
              ) : (
                <Check size={18} aria-hidden="true" />
              )}
              <span>{label}</span>
              <small>{missing ? 'Missing' : 'Complete'}</small>
            </li>
          );
        })}
      </ul>
      <div className="profile-completion-action">
        <button className="button secondary" onClick={close}>
          Not now
        </button>
        <button className="button primary" onClick={edit}>
          Complete Profile
        </button>
      </div>
    </Modal>
  );
}
