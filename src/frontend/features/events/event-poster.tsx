'use client';

import { useEffect, useState } from 'react';
import { useCircle } from '@/frontend/state/circle-context';
import type { EventAttachment } from '@/shared/contracts/responses';

export function EventPoster({
  eventId,
  attachments,
  category,
  index,
  startsAt,
}: {
  eventId: string;
  attachments: EventAttachment[];
  category: string;
  index: number;
  startsAt: string;
}) {
  const { api } = useCircle();
  const [posterUrl, setPosterUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    const posterAttachment = attachments.find((attachment) =>
      attachment.mimeType.startsWith('image/'),
    );

    if (!posterAttachment) {
      setPosterUrl(null);
      return;
    }

    api.events
      .attachment(eventId, posterAttachment.id)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPosterUrl(objectUrl);
      })
      .catch(() => {
        if (active) setPosterUrl(null);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [api, attachments, eventId]);

  const posterStyle = posterUrl
    ? {
        backgroundImage: `linear-gradient(135deg, rgba(9, 19, 31, 0.35), rgba(9, 19, 31, 0.18)), url(${posterUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
    : undefined;

  const eventDate = new Date(startsAt);

  return (
    <div className={`event-art event-art-${index % 3}${posterUrl ? ' has-poster' : ''}`} style={posterStyle}>
      {!posterUrl && (
        <>
          <span>
            {category === 'Hackathon' ? '</>' : category === 'Design' ? '✳' : '↗'}
          </span>
          <small>{category.toUpperCase()}</small>
        </>
      )}
      <div className="event-date">
        <b>{eventDate.getDate()}</b>
        {eventDate.toLocaleDateString('en-IN', { month: 'short' })}
      </div>
    </div>
  );
}
