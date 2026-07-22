import { authService } from './authService';

// Every existing service function throws a plain `Error(message)` on a
// failed fetch, with no status code attached — fine for a single error
// message, but not enough to tell a 401/403 (session expired / forbidden)
// apart from a 400/404 (a real validation or not-found error) without
// re-parsing the response. The new admin functions use this instead so
// pages can react differently to auth failures without duplicating that
// distinction in every .catch.
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Thrown only by apiFetch.ts, only when a 401 could not be resolved by a
// silent refresh (refresh itself failed, or the retried request 401s
// again). This is the one error type that means "the session is over" —
// apiFetch never navigates or clears storage itself (it's transport-only);
// this typed error is how it hands that decision to the session layer
// (handleAuthError below) without depending on React Router.
export class AuthExpiredError extends ApiError {
  constructor(message = 'Session expired') {
    super(message, 401);
    this.name = 'AuthExpiredError';
  }
}

// Reads the backend's { message } error body (or falls back to a generic
// message) and throws an ApiError carrying the HTTP status.
export const throwApiError = async (response: Response, fallback: string): Promise<never> => {
  let message = fallback;
  try {
    const body = await response.json();
    if (body?.message) message = body.message;
  } catch {
    // Empty/non-JSON error body — keep the fallback message.
  }
  throw new ApiError(message, response.status);
};

// The one place the app decides what an auth-adjacent failure means for the
// session (Sprint 01B). apiFetch (transport-only, no navigation) has already
// tried a silent refresh for any 401 before this ever runs — so by the time
// an error reaches here, a 401/AuthExpiredError means the session is
// genuinely over, not just momentarily stale.
//
// This function must only ever be called for requests made through
// apiFetch — i.e., requests made by an already-authenticated caller. It
// must never be wired up to credential-entry endpoints (login, register,
// Google sign-in/link, email verification, future password-recovery
// endpoints) — those don't have a session to expire yet, so a 401 there
// means something entirely different (e.g. an expired Google credential),
// never "your session is over." Those endpoints are called via
// fetchWithTimeout directly, specifically so they can never reach this
// function — see authService.ts's own doc comment on that invariant.
//
// 401 / AuthExpiredError -> the session is unrecoverable: clear auth and
//   redirect to /login exactly once.
// 403 -> a permission failure, not a session failure (e.g. a demoted admin's
//   still-valid token hitting an ADMIN-only route). Never clears auth or
//   redirects — the calling page shows the message inline.
// 429 / 503 -> rate-limited / infrastructure-unavailable. Also never an auth
//   failure — surfaced as a normal retryable message.
export const handleAuthError = (error: unknown, navigate: (path: string) => void): string => {
  const message = error instanceof Error ? error.message : 'Something went wrong';

  const isSessionOver =
    error instanceof AuthExpiredError || (error instanceof ApiError && error.status === 401);

  if (isSessionOver) {
    authService.clearAuth();
    navigate('/login');
  }

  return message;
};
