export default function ThreadDetailLoading() {
  return (
    <main className="page">
      <section className="panel skeleton-card" aria-hidden="true">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line short" />
      </section>
      <section className="panel skeleton-card" aria-hidden="true">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
      </section>
    </main>
  );
}
