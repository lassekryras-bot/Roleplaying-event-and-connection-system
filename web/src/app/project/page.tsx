'use client';

import { useEffect, useState } from 'react';
import { useApiClient } from '@/lib/use-api-client';

export default function ProjectPage() {
  const { getHealth } = useApiClient();
  const [status, setStatus] = useState<string>('Checking...');

  useEffect(() => {
    getHealth()
      .then((data) => setStatus(data.status))
      .catch(() => setStatus('Unavailable'));
  }, [getHealth]);

  return (
    <section>
      <h1>Project</h1>
      <div className="card">
        <p>Server health: {status}</p>
      </div>
    </section>
  );
}
