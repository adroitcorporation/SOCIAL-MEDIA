'use client';
import { useState } from 'react';
import { useCircle } from '@/frontend/state/circle-context';
export function ReportUser({ userId }: { userId: string }) {
  const { api, mutate, busy, toast } = useCircle();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  if (!open)
    return (
      <button className="text-link danger" onClick={() => setOpen(true)}>
        Report user
      </button>
    );
  return (
    <form
      className="event-form"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await mutate(() => api.reports.submit(userId, reason));
          setReason('');
          setOpen(false);
          toast('Report submitted to the moderation team.');
        } catch {}
      }}
    >
      <label>
        What happened?
        <textarea
          required
          minLength={10}
          maxLength={2000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Describe your concern (at least 10 characters)."
        />
      </label>
      <button className="button primary" disabled={busy}>
        Submit report
      </button>
      <button type="button" className="text-link" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </form>
  );
}
