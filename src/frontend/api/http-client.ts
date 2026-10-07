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
    public readonly code?: string,
    public readonly missingFields?: string[],
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
    async blob(path: string): Promise<Blob> {
      const response = await fetcher(`${baseUrl}/${path}`, {
        headers: await headers(),
        cache: 'no-store',
      });
      if (!response.ok) {
        if (response.status === 401) options.onUnauthorized?.();
        const result = (await response.json()) as ApiErrorResponse;
        throw new ApiError(response.status, result.error || 'Unable to load image.');
      }
      return response.blob();
    },
    async upload<T>(path: string, file: File): Promise<T> {
      const response = await fetcher(`${baseUrl}/${path}`, {
        method: 'POST',
        headers: {
          ...(await headers()),
          'Content-Type': 'application/octet-stream',
          'X-Event-Attachment-Type': file.type,
        },
        body: file,
        cache: 'no-store',
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401) options.onUnauthorized?.();
        throw new ApiError(
          response.status,
          (result as ApiErrorResponse).error || 'Unable to upload attachment.',
        );
      }
      return result as T;
    },
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
          (result as ApiErrorResponse).code,
          (result as ApiErrorResponse).missingFields,
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
