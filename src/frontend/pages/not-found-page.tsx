import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="auth-page">
      <section className="panel">
        <h1>Page not found.</h1>
        <p className="muted">The link may have changed.</p>
        <Link className="button primary" href="/">
          Back to home
        </Link>
      </section>
    </main>
  );
}
