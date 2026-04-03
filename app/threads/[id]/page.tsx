import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Role, THREADS } from '@/lib/data';

type DetailPageProps = {
  params: { id: string };
  searchParams: { role?: Role };
};

export default function ThreadDetailPage({ params, searchParams }: DetailPageProps) {
  const thread = THREADS.find((candidate) => candidate.id === params.id);
  if (!thread) notFound();

  const role: Role = searchParams.role ?? 'PLAYER';
  const canViewGMTruth = role === 'GM' || role === 'HELPER_GM';

  return (
    <main className="page">
      <p>
        <Link href="/threads">← Back to thread list</Link>
      </p>

      <section className="panel">
        <h1>{thread.title}</h1>
        <p>
          <strong>Hook:</strong> {thread.hook}
        </p>
        <p>
          <strong>Summary:</strong> {thread.summary}
        </p>
      </section>

      <section className="panel">
        <h2>Linked entities</h2>
        <p className="placeholder">Placeholder: linked PCs, NPCs, factions, and locations will render here.</p>
      </section>

      {canViewGMTruth && (
        <section className="panel gm-truth">
          <h2>GM Truth</h2>
          <p>{thread.gmTruth}</p>
        </section>
      )}

      {!canViewGMTruth && <p className="role-indicator">GM-only fields hidden</p>}
    </main>
  );
}
