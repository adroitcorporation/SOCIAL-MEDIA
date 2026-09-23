'use client';

import { useEffect, useState } from 'react';
import { Check, Mail, X } from 'lucide-react';
import { useCircle } from '@/frontend/state/circle-context';
import type { VerificationReviewItem } from '@/shared/contracts/responses';
import { Avatar } from '@/frontend/components/ui';
import { PageHeading } from '@/frontend/components/page-heading';

function DocumentPreview({ request }: { request: VerificationReviewItem }) {
  const { api } = useCircle();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    api.moderation
      .document(request.id)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((error: unknown) => {
        if (active) setError(error instanceof Error ? error.message : 'Unable to load image.');
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [api, request.id]);
  if (error)
    return (
      <p role="alert" className="error">
        {error}
      </p>
    );
  return url ? (
    <img
      className="verification-document"
      src={url}
      alt={`College ID submitted by ${request.user.name}`}
    />
  ) : (
    <p className="muted">Loading private image...</p>
  );
}

export function ModerationPage() {
  const { api, mutate, toast } = useCircle();
  const [requests, setRequests] = useState<VerificationReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    api.moderation
      .list()
      .then((items) => {
        if (active) setRequests(items);
      })
      .catch((error: unknown) => {
        if (active) setError(error instanceof Error ? error.message : 'Unable to load reviews.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api]);
  async function review(id: string, status: 'APPROVED' | 'REJECTED') {
    if (reviewing) return;
    setReviewing(id);
    try {
      await mutate(() => api.moderation.review(id, { status, reviewNote: notes[id] || '' }));
      setRequests(await api.moderation.list());
      toast(status === 'APPROVED' ? 'Student verified.' : 'Verification rejected.');
    } catch {
    } finally {
      setReviewing(null);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="KEEPING THE CIRCLE TRUSTWORTHY"
        title="Verification review"
        description="Review college email and ID submissions before students can connect."
      />
      {loading ? (
        <p className="muted">Loading submissions...</p>
      ) : error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : !requests.length ? (
        <section className="panel empty">
          <h3>Nothing waiting for review.</h3>
          <p className="muted">New submissions will appear here.</p>
        </section>
      ) : (
        <div className="moderation-list">
          {requests.map((request) => (
            <article className="panel moderation-item" key={request.id}>
              <div className="moderation-person">
                <Avatar user={request.user} />
                <div>
                  <h3>{request.user.name}</h3>
                  <p className="muted">
                    {request.user.college} · {request.user.degree}
                  </p>
                </div>
              </div>
              <p className="muted">Submitted {new Date(request.createdAt).toLocaleString()}</p>
              {request.method === 'EMAIL' ? (
                <div className="moderation-proof">
                  <Mail size={17} />
                  <span>{request.collegeEmail}</span>
                </div>
              ) : (
                <DocumentPreview request={request} />
              )}
              <label>
                Review note (visible to the student)
                <textarea
                  maxLength={500}
                  value={notes[request.id] || ''}
                  onChange={(event) =>
                    setNotes((current) => ({ ...current, [request.id]: event.target.value }))
                  }
                />
              </label>
              <div className="moderation-actions">
                <button
                  className="button primary"
                  disabled={!!reviewing}
                  onClick={() => review(request.id, 'APPROVED')}
                >
                  <Check size={16} /> Approve
                </button>
                <button
                  className="button secondary"
                  disabled={!!reviewing}
                  onClick={() => review(request.id, 'REJECTED')}
                >
                  <X size={16} /> Reject
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
