'use client';
import type { AppState } from '@/shared/contracts/responses';
export function FeedPagination({
  feed,
  setPage,
}: {
  feed: AppState['feed'];
  setPage: (page: number) => void;
}) {
  if (!feed || (!feed.page && !feed.hasNext)) return null;
  return (
    <div className="pagination">
      <button
        className="button secondary"
        disabled={!feed.page}
        onClick={() => setPage(feed.page - 1)}
      >
        Previous
      </button>
      <span>Page {feed.page + 1}</span>
      <button
        className="button secondary"
        disabled={!feed.hasNext}
        onClick={() => setPage(feed.page + 1)}
      >
        Next
      </button>
    </div>
  );
}
