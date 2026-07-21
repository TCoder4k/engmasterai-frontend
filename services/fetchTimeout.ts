// Bounds how long the frontend waits for a response, independent of
// whatever the backend is doing internally. Native `fetch` has no default
// timeout, so a stuck backend request can hang the calling UI indefinitely.
//
// This exists because of a real finding during Sprint 01B verification: a
// `POST /auth/logout` call issued in a specific Redis-reconnect timing
// window sat unresolved for minutes instead of failing fast with the 503
// its own design intends (ioredis's offline command queue isn't governed by
// `maxRetriesPerRequest` the same way an already-in-flight command is — a
// pre-existing Sprint 01A backend/Redis-config gap, out of scope to fix
// here). This is a purely client-side defensive bound: it does not fix the
// backend's retry/reconnect behavior, it just guarantees the frontend never
// waits forever on it. Used by both authService.ts and apiFetch.ts.
const DEFAULT_TIMEOUT_MS = 15000;

export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
