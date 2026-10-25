/* The only network entry point in the app.
 *
 * Every failure becomes an ApiError with a stable code, so screens can show a
 * real message instead of a raw exception. Nothing here retries silently: a
 * retry that hides a failure is how a user loses trust in the data.
 */

import { getApiUrl } from './apiConfig';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'DELETE' | 'PATCH' | 'PUT';
  body?: unknown;
  token?: string | null;
  timeoutMs?: number;
}

interface ErrorBody {
  error?: { code?: string; message?: string };
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const base = await getApiUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);

  try {
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (options.token) headers.authorization = `Bearer ${options.token}`;

    const response = await fetch(`${base}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });

    const text = await response.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }

    if (!response.ok) {
      const body = parsed as ErrorBody | null;
      throw new ApiError(
        response.status,
        body?.error?.code ?? 'request_failed',
        body?.error?.message ?? `Request failed (${response.status}).`,
      );
    }

    return parsed as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(0, 'timeout', 'The server did not answer in time. Check your connection.');
    }
    throw new ApiError(
      0,
      'network_error',
      "Can't reach the server. Check your connection and the server address.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

/** User-facing text for an unknown error. Never invents a cause. */
export function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Try again.';
}
