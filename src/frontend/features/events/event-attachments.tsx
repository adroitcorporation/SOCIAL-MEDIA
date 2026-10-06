'use client';

import { useEffect, useState } from 'react';
import { Download, FileText, Image as ImageIcon, RotateCw } from 'lucide-react';
import { useCircle } from '@/frontend/state/circle-context';
import type { EventAttachment as EventAttachmentItem } from '@/shared/contracts/responses';

function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function EventAttachments({
  eventId,
  attachments,
}: {
  eventId: string;
  attachments: EventAttachmentItem[];
}) {
  const { api } = useCircle();
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [previewError, setPreviewError] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const urls: string[] = [];
    setPreviews({});
    setPreviewError(false);
    Promise.all(
      attachments
        .filter((attachment) => attachment.mimeType.startsWith('image/'))
        .map(async (attachment) => {
          try {
            const blob = await api.events.attachment(eventId, attachment.id);
            if (!active) return null;
            const url = URL.createObjectURL(blob);
            urls.push(url);
            return [attachment.id, url] as const;
          } catch {
            if (active) setPreviewError(true);
            return null;
          }
        }),
    ).then((results) => {
      if (active)
        setPreviews(
          Object.fromEntries(
            results.filter((result): result is NonNullable<typeof result> => !!result),
          ),
        );
    });
    return () => {
      active = false;
      urls.forEach(URL.revokeObjectURL);
    };
  }, [api, attachments, eventId]);

  async function download(attachment: EventAttachmentItem) {
    if (downloading) return;
    setDownloadError('');
    setDownloading(attachment.id);
    try {
      saveFile(await api.events.attachment(eventId, attachment.id), attachment.name);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Could not download attachment.');
    } finally {
      setDownloading(null);
    }
  }

  if (!attachments.length) return null;
  return (
    <section className="event-attachments" aria-label="Event attachments">
      <h3>Event information</h3>
      {previewError && (
        <p className="muted" role="status">
          Some image previews could not be loaded. You can still download the files.
        </p>
      )}
      {downloadError && (
        <p className="error" role="alert">
          {downloadError}
        </p>
      )}
      <div className="event-attachment-list">
        {attachments.map((attachment) => {
          const image = attachment.mimeType.startsWith('image/');
          const preview = previews[attachment.id];
          return (
            <article className="event-attachment" key={attachment.id}>
              {image && preview ? (
                <img src={preview} alt={`Preview of ${attachment.name}`} loading="lazy" />
              ) : (
                <span className="event-attachment-icon" aria-hidden="true">
                  {image ? <ImageIcon size={22} /> : <FileText size={22} />}
                </span>
              )}
              <div className="event-attachment-copy">
                <strong>{attachment.name}</strong>
                <small>{(attachment.size / 1_000_000).toFixed(1)} MB</small>
              </div>
              <button
                className="icon-button"
                aria-label={`Download ${attachment.name}`}
                title={`Download ${attachment.name}`}
                disabled={downloading !== null}
                onClick={() => void download(attachment)}
              >
                {downloading === attachment.id ? (
                  <RotateCw size={17} className="event-attachment-spinning" />
                ) : (
                  <Download size={17} />
                )}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
