'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth-page">
      <section className="panel">
        <h1>Let’s try that again.</h1>
        <p>We couldn’t load this page. Your saved work is safe.</p>
        <button className="button primary" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
