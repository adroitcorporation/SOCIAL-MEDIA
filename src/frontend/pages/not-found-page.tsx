import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="auth-page">
      <section className="panel">
        <span className="eyebrow">A LITTLE OFF THE BEATEN PATH</span>
        <h1>This page isn’t in your circle.</h1>
        <p className="muted">The link might have changed. Let’s take you back.</p>
        <Link className="button primary" href="/">
          Back to home
        </Link>
      </section>
    </main>
  );
}
