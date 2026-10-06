'use client';
import { useEffect, useState } from 'react';
import { useCircle } from '@/frontend/state/circle-context';
import type { EventItem } from '@/shared/contracts/responses';
import { eventSchema } from '@/shared/contracts/moderation';
import { Pagination } from '@/frontend/components/pagination';
import { Modal } from '@/frontend/components/ui';
import {
  EVENT_ATTACHMENT_MAX_BYTES,
  EVENT_ATTACHMENT_MAX_FILES,
  EVENT_ATTACHMENT_MAX_TOTAL_BYTES,
  EVENT_ATTACHMENT_TYPES,
} from '@/shared/contracts/event-attachments';
import { FileText, Image as ImageIcon, X } from 'lucide-react';

export function EventManager() {
  const { api, mutate, busy, toast, refresh, state } = useCircle();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [editing, setEditing] = useState<EventItem | 'new' | null>(null);
  const [deleting, setDeleting] = useState<EventItem | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [uploadedFiles, setUploadedFiles] = useState<Set<File>>(new Set());
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [attachmentError, setAttachmentError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.events
      .managed(new URLSearchParams({ search, page: String(page) }).toString())
      .then((items) => {
        if (active) setEvents(items);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, revision, page, search]);
  const item = editing && editing !== 'new' ? editing : null;
  const remainingAttachments = (item?.attachments ?? []).filter(
    (attachment) => !removedIds.has(attachment.id),
  );
  const remainingBytes =
    remainingAttachments.reduce((total, attachment) => total + attachment.size, 0) +
    selectedFiles.reduce((total, file) => total + file.size, 0);
  function selectAttachments(files: FileList | null) {
    if (!files) return;
    const picked = Array.from(files);
    const invalid = picked.find(
      (file) =>
        !EVENT_ATTACHMENT_TYPES.some((type) => type === file.type) ||
        !file.size ||
        file.size > EVENT_ATTACHMENT_MAX_BYTES,
    );
    if (invalid) {
      toast(`${invalid.name}: choose a PDF, JPG, PNG, or WebP up to 8 MB.`, true);
      return;
    }
    const available =
      EVENT_ATTACHMENT_MAX_FILES - remainingAttachments.length - selectedFiles.length;
    if (picked.length > available) {
      toast(`An event can have at most ${EVENT_ATTACHMENT_MAX_FILES} attachments.`, true);
      return;
    }
    if (
      remainingBytes + picked.reduce((total, file) => total + file.size, 0) >
      EVENT_ATTACHMENT_MAX_TOTAL_BYTES
    ) {
      toast('Event attachments can total at most 20 MB.', true);
      return;
    }
    setSelectedFiles((current) => [...current, ...picked]);
    setAttachmentError('');
  }
  function resetAttachments() {
    setSelectedFiles([]);
    setRemovedIds(new Set());
    setUploadedFiles(new Set());
    setDeletedIds(new Set());
    setAttachmentError('');
  }
  return (
    <section className="panel moderation-section">
      <div className="moderation-actions">
        <h2>Manage events</h2>
        <button
          className="button primary"
          onClick={() => {
            resetAttachments();
            setEditing('new');
          }}
        >
          Create event
        </button>
      </div>
      <label>
        Search your manageable events
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Event title"
        />
      </label>
      <p className="muted">Includes past events. 100 events per page.</p>
      {loading ? (
        <p>Loading events…</p>
      ) : error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : !events.length ? (
        <p className="muted">No events yet.</p>
      ) : (
        events.map((event) => (
          <div className="managed-event" key={event.id}>
            <span>
              <strong>{event.title}</strong>
              <br />
              <small>{new Date(event.startsAt).toLocaleString()}</small>
            </span>
            <div className="moderation-actions">
              <button
                className="button secondary"
                onClick={() => {
                  resetAttachments();
                  setEditing(event);
                }}
              >
                Edit
              </button>
              <button className="button secondary danger" onClick={() => setDeleting(event)}>
                Delete
              </button>
            </div>
          </div>
        ))
      )}
      <Pagination page={page} setPage={setPage} count={events.length} loading={loading} />
      {editing && (
        <Modal
          title={item ? 'Edit event' : 'Create event'}
          onClose={() => {
            if (saving) return;
            setEditing(null);
            resetAttachments();
          }}
        >
          <form
            className="event-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const raw = Object.fromEntries(form);
              const date = new Date(String(raw.startsAt));
              const parsed = eventSchema.safeParse({
                ...raw,
                startsAt: Number.isNaN(date.getTime()) ? '' : date.toISOString(),
              });
              if (!parsed.success) {
                toast(parsed.error.issues[0].message, true);
                return;
              }
              setSaving(true);
              setAttachmentError('');
              let eventSaved = false;
              try {
                const saved = await mutate(() =>
                  item ? api.events.edit(item.id, parsed.data) : api.events.create(parsed.data),
                );
                eventSaved = true;
                const eventId = saved.id;
                if (!item)
                  setEditing({
                    ...parsed.data,
                    id: eventId,
                    ownerId: state.me.id,
                    createdAt: new Date().toISOString(),
                    startsAt: parsed.data.startsAt,
                    attachments: [],
                    savedBy: [],
                  });
                for (const attachment of item?.attachments ?? [])
                  if (removedIds.has(attachment.id) && !deletedIds.has(attachment.id)) {
                    await api.events.deleteAttachment(eventId, attachment.id);
                    setDeletedIds((current) => new Set(current).add(attachment.id));
                  }
                for (const file of selectedFiles)
                  if (!uploadedFiles.has(file)) {
                    await api.events.uploadAttachment(eventId, file);
                    setUploadedFiles((current) => new Set(current).add(file));
                  }
                await refresh();
                setEditing(null);
                setRevision((v) => v + 1);
                resetAttachments();
                toast('Event saved.');
              } catch (cause) {
                setAttachmentError(
                  cause instanceof Error
                    ? `${eventSaved ? 'Event details were saved, but an attachment could not be saved' : 'Could not save the event'}: ${cause.message}`
                    : eventSaved
                      ? 'Event details were saved, but an attachment could not be saved.'
                      : 'Could not save the event.',
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            <label>
              Title
              <input name="title" required maxLength={120} defaultValue={item?.title} />
            </label>
            <label>
              Description
              <textarea
                name="description"
                required
                maxLength={5000}
                defaultValue={item?.description}
              />
            </label>
            <label>
              Category
              <input name="category" required maxLength={60} defaultValue={item?.category} />
            </label>
            <label>
              Organiser name
              <input name="organizer" required maxLength={120} defaultValue={item?.organizer} />
            </label>
            <label>
              Location
              <input name="location" required maxLength={200} defaultValue={item?.location} />
            </label>
            <label>
              Start time (your local time)
              <input
                type="datetime-local"
                name="startsAt"
                required
                defaultValue={
                  item
                    ? new Date(
                        new Date(item.startsAt).getTime() -
                          new Date(item.startsAt).getTimezoneOffset() * 60000,
                      )
                        .toISOString()
                        .slice(0, 16)
                    : ''
                }
              />
            </label>
            <label>
              Event website (HTTPS)
              <input type="url" name="url" required maxLength={2048} defaultValue={item?.url} />
            </label>
            <section className="event-attachment-editor" aria-label="Event attachments">
              <div>
                <strong>Event information</strong>
                <small>Attach PDFs or images with schedules, maps, or other useful details.</small>
              </div>
              <label className="event-attachment-picker">
                <span className="button secondary">
                  <FileText size={16} /> Add PDF or images
                </span>
                <input
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  multiple
                  disabled={
                    busy ||
                    saving ||
                    remainingAttachments.length + selectedFiles.length >= EVENT_ATTACHMENT_MAX_FILES
                  }
                  onChange={(event) => {
                    selectAttachments(event.target.files);
                    event.currentTarget.value = '';
                  }}
                />
              </label>
              <small className="muted">
                JPG, PNG, WebP, or PDF · Up to 8 MB each, 20 MB total ·{' '}
                {remainingAttachments.length + selectedFiles.length}/{EVENT_ATTACHMENT_MAX_FILES}
              </small>
              {(item?.attachments ?? [])
                .filter((attachment) => !removedIds.has(attachment.id))
                .map((attachment) => (
                  <div className="event-attachment-row" key={attachment.id}>
                    <span>
                      {attachment.mimeType.startsWith('image/') ? (
                        <ImageIcon size={17} />
                      ) : (
                        <FileText size={17} />
                      )}
                    </span>
                    <strong>{attachment.name}</strong>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove ${attachment.name}`}
                      disabled={busy || saving}
                      onClick={() =>
                        setRemovedIds((current) => new Set(current).add(attachment.id))
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              {selectedFiles.map((file, index) => (
                <div
                  className="event-attachment-row"
                  key={`${file.name}-${file.lastModified}-${index}`}
                >
                  <span>
                    {file.type.startsWith('image/') ? (
                      <ImageIcon size={17} />
                    ) : (
                      <FileText size={17} />
                    )}
                  </span>
                  <strong>{file.name}</strong>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove ${file.name}`}
                    disabled={busy || saving}
                    onClick={() =>
                      setSelectedFiles((current) =>
                        current.filter((_, currentIndex) => currentIndex !== index),
                      )
                    }
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              {attachmentError && (
                <p className="error" role="alert">
                  {attachmentError}
                </p>
              )}
            </section>
            <button className="button primary" disabled={busy || saving}>
              {busy || saving ? 'Saving…' : 'Save event'}
            </button>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal title="Delete event?" onClose={() => setDeleting(null)}>
          <p>Delete “{deleting.title}”? This also removes saved bookmarks.</p>
          <button
            className="button primary"
            disabled={busy}
            onClick={async () => {
              try {
                await mutate(() => api.events.delete(deleting.id));
                setDeleting(null);
                setRevision((v) => v + 1);
                toast('Event deleted.');
              } catch {}
            }}
          >
            Confirm deletion
          </button>
        </Modal>
      )}
    </section>
  );
}
