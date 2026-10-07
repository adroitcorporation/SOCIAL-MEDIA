import { afterEach, expect, it, vi } from 'vitest';
import { errorResponse } from '@/backend/http/error-response';
afterEach(() => vi.restoreAllMocks());
it('does not write raw private payloads or token-shaped strings to unexpected-error logs', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const response = errorResponse(new Error('synthetic-private-message synthetic-access-token'));
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: 'Something went wrong. Please try again.' });
  expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic-private-message');
  expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic-access-token');
  expect(JSON.stringify(log.mock.calls)).toContain('api_request_failed');
});
