'use client';

export function Pagination({
  page,
  setPage,
  count,
  loading,
}: {
  page: number;
  setPage: (page: number) => void;
  count: number;
  loading: boolean;
}) {
  return (
    <div className="moderation-actions">
      <button
        className="button secondary"
        disabled={loading || page === 0}
        onClick={() => setPage(page - 1)}
      >
        Previous page
      </button>
      <span>Page {page + 1}</span>
      <button
        className="button secondary"
        disabled={loading || count < 100}
        onClick={() => setPage(page + 1)}
      >
        Next page
      </button>
    </div>
  );
}
