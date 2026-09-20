import type { ApiErrorResponse } from '@/shared/contracts/responses';

export interface HttpClientOptions {
  baseUrl?: string;
  getAccessToken?: () => Promise<string | undefined>;
  onUnauthorized?: () => void;
  fetch?: typeof globalThis.fetch;
}
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export function createHttpClient(options: HttpClientOptions = {}) {
  const baseUrl = (options.baseUrl ?? '/api').replace(/\/$/, '');
  const fetcher = options.fetch ?? globalThis.fetch;
  async function headers(json = false): Promise<Record<string, string>> {
    const token = await options.getAccessToken?.();
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(json ? { 'Content-Type': 'application/json' } : {}),
    };
  }
  return {
    async request<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
      const response = await fetcher(`${baseUrl}/${path}`, {
        method: body === undefined ? 'GET' : method,
        headers: await headers(body !== undefined),
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401) options.onUnauthorized?.();
        throw new ApiError(
          response.status,
          (result as ApiErrorResponse).error || 'Unable to complete this action.',
        );
      }
      return result as T;
    },
    async openStream(path: string, signal: AbortSignal) {
      return fetcher(`${baseUrl}/${path}`, { headers: await headers(), signal });
    },
  };
}
export type HttpClient = ReturnType<typeof createHttpClient>;
