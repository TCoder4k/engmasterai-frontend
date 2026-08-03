import { authService } from './authService';
import type { StudyHeartbeatBody } from './studyTimeService';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Sprint 10.5 — the BEST-EFFORT flush, for `visibilitychange -> hidden` and
// `pagehide`. Deliberately NOT apiFetch, and this is the most load-bearing
// decision in the frontend half of this sprint.
//
// WHY NOT apiFetch. On a 401 it calls refreshCoordinator.refresh(), and this
// project's refresh tokens are opaque, rotating and STRICTLY SINGLE-USE. The
// access token lives ten minutes while the heartbeat flushes every minute, so a
// flush landing on an expired token is routine, not rare. At pagehide the
// document is being torn down: the server would rotate the refresh token while
// the client never persists the replacement, and the student's NEXT visit finds
// a consumed token and gets signed out. Losing the final buffered window costs
// at most 60 seconds of credit; losing the refresh token costs the session.
//
// WHY NO AbortController. fetchWithTimeout attaches one to every request, and a
// timer living in a document that is being destroyed has no business deciding
// the fate of a keepalive request — that is the one kind of request explicitly
// designed to outlive its page.
//
// WHY NOT navigator.sendBeacon. It cannot carry an Authorization header, so the
// request would arrive unauthenticated. Same reasoning progressService.ts
// already recorded for the video-progress flush.
//
// WHY IT MUTATES NO AUTH STATE. It does not read a response, does not throw and
// does not clear anything. A failure here is not a session event; it is one
// unrecorded minute.

/**
 * Fire a heartbeat that may outlive the document. Never throws.
 *
 * Returns nothing on purpose: there is no meaningful response to wait for, and
 * a caller that awaited it would be blocking page teardown for a value it
 * cannot act on.
 */
export const sendStudyBeacon = (body: StudyHeartbeatBody): void => {
  const token = authService.getToken();
  // No token means logged out — a heartbeat now would be rejected anyway, and
  // firing one is how an unauthenticated request ends up in the log.
  if (!token) return;

  try {
    void fetch(`${API_BASE_URL}/study-time/heartbeat`, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    }).catch(() => {
      // Swallowed on purpose. The page is going away; there is nobody to tell.
    });
  } catch {
    // Some browsers throw synchronously when a keepalive request cannot be
    // queued during unload. That is still just a lost minute.
  }
};
