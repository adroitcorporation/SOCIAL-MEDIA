'use client';

import { useEffect, useRef, useState } from 'react';

import { CheckCircle2, FileImage, Mail, Pencil, Globe, Upload } from 'lucide-react';

import { useCircle } from '@/frontend/state/circle-context';

import { ProfileForm } from '@/frontend/features/profile/profile-form';
import { ProfileContent } from '@/frontend/features/profile/profile-content';

import { PageHeading } from '@/frontend/components/page-heading';
import { ThemeToggle } from '@/frontend/components/theme-toggle';
import {
  MAX_VERIFICATION_IMAGE_BYTES,
  VERIFICATION_IMAGE_TYPES,
} from '@/shared/contracts/verification';
export function ProfilePage() {
  const { api, state, mutate, toast } = useCircle();
  const [edit, setEdit] = useState(!state.me.onboarded);
  const [method, setMethod] = useState<'EMAIL' | 'COLLEGE_ID'>('EMAIL');
  const [collegeEmail, setCollegeEmail] = useState('');
  const [document, setDocument] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<FileReader | null>(null);
  useEffect(() => () => readerRef.current?.abort(), []);
  const verification = state.verification;
  async function submitVerification(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await mutate(() =>
        api.verification.submit({
          method,
          collegeEmail: method === 'EMAIL' ? collegeEmail : undefined,
          documentUrl: method === 'COLLEGE_ID' ? document : undefined,
        }),
      );
      toast('Verification submitted. Moderators will review it shortly.');
      setCollegeEmail('');
      setDocument('');
      if (fileRef.current) fileRef.current.value = '';
    } catch {}
    setSubmitting(false);
  }
  function readDocument(file: File | undefined) {
    readerRef.current?.abort();
    setDocument('');
    if (!file) return;
    if (
      !VERIFICATION_IMAGE_TYPES.some((type) => type === file.type) ||
      !file.size ||
      file.size > MAX_VERIFICATION_IMAGE_BYTES
    ) {
      if (fileRef.current) fileRef.current.value = '';
      toast('Upload a JPG, PNG, or WebP image up to 4 MB.', true);
      return;
    }
    const reader = new FileReader();
    readerRef.current = reader;
    reader.onload = () => setDocument(String(reader.result));
    reader.onerror = () => toast('Unable to read the image. Please select it again.', true);
    reader.readAsDataURL(file);
  }
  return (
    <>
      <PageHeading title="Profile">
        <div className="profile-header-actions">
          <ThemeToggle />
          <button className="button primary" onClick={() => setEdit(!edit)}>
            <Pencil size={16} />
            {edit ? 'View profile' : 'Edit profile'}
          </button>
        </div>
      </PageHeading>
      <div className="profile-layout">
        <section className="panel">
          {edit ? (
            <ProfileForm
              user={state.me}
              save={async (body) => {
                await mutate(() => api.profiles.update(body));
                setEdit(false);
                toast('Profile saved.');
              }}
            />
          ) : (
            <ProfileContent user={state.me} />
          )}
        </section>
        <aside>
          <section className="panel verification-panel">
            <span className="stat-icon mint">
              {state.me.collegeVerified ? <CheckCircle2 size={22} /> : <Globe size={22} />}
            </span>
            <h3>{state.me.collegeVerified ? 'College verified.' : 'Verify your college'}</h3>
            <p className="muted">
              {state.me.collegeVerified
                ? 'You can now send connection requests to other students.'
                : 'Verify your college to send connection requests.'}
            </p>
            {state.me.collegeVerified ? null : verification?.status === 'PENDING' ? (
              <p className="notice">
                Your {verification.method === 'EMAIL' ? 'college email' : 'ID'} submission is under
                moderator review.
              </p>
            ) : (
              <form onSubmit={submitVerification}>
                <div className="verification-options" role="group" aria-label="Verification method">
                  <button
                    type="button"
                    aria-pressed={method === 'EMAIL'}
                    className={`verification-option ${method === 'EMAIL' ? 'selected' : ''}`}
                    onClick={() => setMethod('EMAIL')}
                  >
                    <Mail size={16} /> College email
                  </button>
                  <button
                    type="button"
                    aria-pressed={method === 'COLLEGE_ID'}
                    className={`verification-option ${method === 'COLLEGE_ID' ? 'selected' : ''}`}
                    onClick={() => setMethod('COLLEGE_ID')}
                  >
                    <FileImage size={16} /> College ID
                  </button>
                </div>
                {method === 'EMAIL' ? (
                  <label>
                    College email
                    <input
                      type="email"
                      value={collegeEmail}
                      onChange={(event) => setCollegeEmail(event.target.value)}
                      placeholder="you@college.edu"
                      required
                    />
                    <small>Use the email issued by your college. A moderator will review it.</small>
                  </label>
                ) : (
                  <label>
                    College ID image
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => readDocument(event.target.files?.[0])}
                      required={!document}
                    />
                    <small>
                      {document
                        ? 'Image ready to send for review.'
                        : 'JPG, PNG, or WebP up to 4 MB.'}
                    </small>
                  </label>
                )}
                <button
                  className="button primary full"
                  disabled={submitting || (method === 'COLLEGE_ID' && !document)}
                >
                  <Upload size={16} /> Submit for review
                </button>
              </form>
            )}
            {verification?.status === 'REJECTED' && (
              <p className="error">
                Previous submission was not approved
                {verification.reviewNote ? `: ${verification.reviewNote}` : '.'} You can submit
                again.
              </p>
            )}
          </section>
          <div className="panel">
            <span className="stat-icon mint">
              <Globe size={22} />
            </span>
            <h3>Verification privacy</h3>

            <small>
              Verification requests are reviewed by moderators. Your profile remains visible while a
              request is pending.
            </small>
          </div>
          {state.blockedIds.length > 0 && (
            <div className="panel blocked-panel">
              <h3>Blocked connections</h3>
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
