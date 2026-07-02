// Central place for the backend base URL and a small fetch helper.
// Configure with NEXT_PUBLIC_API_URL (see .env.example); falls back to local dev.

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

/** Build a full API URL from a path like "/api/v1/query". */
export function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * fetch() wrapper that always sends the HttpOnly session cookie and defaults
 * to JSON. Throws an Error with the backend `detail` message on non-2xx.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(apiUrl(path), {
    credentials: "include",
    ...options,
  });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
