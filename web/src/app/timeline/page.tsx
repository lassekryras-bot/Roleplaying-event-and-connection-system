'use client';

import { useEffect, useState } from 'react';
import { TimelineEvent } from '@/lib/api';
import { useApiClient } from '@/lib/use-api-client';

export default function TimelinePage() {
  const { getTimelineEvents } = useApiClient();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    getTimelineEvents()
      .then((data) => setEvents(data))
      .catch((err: Error) => setError(err.message));
  }, [getTimelineEvents]);

  return (
    <section>
      <h1>Timeline</h1>
      {error && <p>{error}</p>}
      <ul className="card-list">
        {events.map((event) => (
          <li key={event.id} className="card">
            <strong>{event.label}</strong>
            <div>Type: {event.type}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
