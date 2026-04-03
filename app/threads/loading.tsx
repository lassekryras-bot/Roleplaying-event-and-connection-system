export default function ThreadsLoading() {
  return (
    <main className="page">
      <h1>Threads</h1>
      <section className="thread-list">
        {[1, 2, 3].map((item) => (
          <article key={item} className="thread-card skeleton-card" aria-hidden="true">
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line short" />
          </article>
        ))}
      </section>
    </main>
  );
}
