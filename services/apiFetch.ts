import { authService } from './authService';
import { refreshCoordinator } from './refreshCoordinator';
import { AuthExpiredError } from './apiError';
import { fetchWithTimeout } from './fetchTimeout';

// Transport-only fetch wrapper (Sprint 01B). Attaches the current access
// token, always sends credentials (so the httpOnly emai_rt cookie reaches
// /auth/refresh), and silently recovers from exactly one 401 via the shared
// RefreshCoordinator before giving up.
//
// Deliberately does NOT know about React Router, does NOT clear auth state,
// and does NOT redirect — a terminal auth failure is a typed
// AuthExpiredError thrown to the caller. Where that error is turned into a
// clearAuth() + navigate('/login') is the session/application layer's job
// (see apiError.ts's handleAuthError), not this module's.
//
// For every status other than a terminal 401, the raw Response is returned
// unchanged (whatever its `.ok`/`.status` is) — 403/429/503/400/404/etc. are
// left for the caller to interpret exactly as they do today (most service
// functions already do `if (!response.ok) return throwApiError(...)`).
const buildHeaders = (init?: HeadersInit): Headers => {
  const headers = new Headers(init);
  const token = authService.getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
};

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const send = (): Promise<Response> =>
    fetchWithTimeout(input, {
      ...init,
      headers: buildHeaders(init.headers),
      credentials: 'include',
    });

  const response = await send();
  if (response.status !== 401) return response;

  try {
    await refreshCoordinator.refresh();
  } catch {
    throw new AuthExpiredError();
  }

  // Retry exactly once, with whatever token the refresh just persisted
  // (buildHeaders() re-reads authService.getToken() fresh). Never retried
  // a second time — a 401 here means the session is genuinely over.
  const retried = await send();
  if (retried.status === 401) {
    throw new AuthExpiredError();
  }
  return retried;
}
