import { clearRecentActivity } from './recentActivity';
import { clearAllVideoProgress } from './videoProgress';
import { fetchWithTimeout } from './fetchTimeout';
// Deliberate circular import (refreshCoordinator.ts imports authService for
// authService.refresh(); authService.ts imports refreshCoordinator here for
// cancelAll()). Safe because neither module touches the other's export at
// module-evaluation time — only inside function bodies invoked later, by
// which point both modules have finished initializing (standard for two
// singleton services that call into each other).
import { refreshCoordinator } from './refreshCoordinator';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Fired whenever the authenticated user changes (login, logout, forced
// logout on 401/403). Client-side-only listeners (e.g. ThemeProvider, which
// scopes the theme preference per user) re-sync off this, since a SPA
// login/logout navigates without remounting app-root providers.
export const AUTH_CHANGED_EVENT = 'emai:auth-changed';

const emitAuthChanged = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  }
};

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  role: 'USER' | 'ADMIN';
}

export interface AuthResponse {
  message: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatarUrl?: string;
  };
  accessToken: string;
}

export interface ErrorResponse {
  message: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

// Thrown by googleLogin() when the backend returns 409/ACCOUNT_LINK_REQUIRED
// — a verified Google email matches an existing local (password-based)
// account with no linked Google identity yet. Distinct from every other
// auth error so the UI can render the link-confirmation panel instead of a
// generic error banner (see engmasterai-backend's
// AccountLinkRequiredException / docs/adr/004-google-auth.md).
export class AccountLinkRequiredError extends Error {
  email: string;
  constructor(email: string, message: string) {
    super(message);
    this.name = 'AccountLinkRequiredError';
    this.email = email;
  }
}

// POST /auth/refresh's body — access token only (no `message`, no `user`;
// see engmasterai-backend/src/auth/auth.controller.ts's refresh()).
export interface RefreshResponse {
  accessToken: string;
}

// Result of a logout attempt. `degraded` is true only when the backend
// could not confirm server-side revocation (a 503 — Redis unreachable, or
// the request never reached the backend at all) — the frontend session is
// cleared either way; this only tells the caller whether it's safe to
// assume every device is now logged out.
export interface LogoutResult {
  degraded: boolean;
}

export const authService = {
  async register(data: RegisterRequest): Promise<AuthResponse> {
    // credentials: 'include' is required here (not just on refresh/logout)
    // — the frontend (5174) and backend (3000) are different origins, and
    // without it the browser silently discards the response's Set-Cookie
    // for emai_rt, so no refresh session would ever be captured to begin
    // with. This is a necessary corollary of consuming Sprint 01A's
    // cookie-based refresh design, not a new decision.
    const response = await fetchWithTimeout(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw error;
    }

    return response.json();
  },

  async login(data: LoginRequest): Promise<AuthResponse> {
    // See the credentials note on register() above — same requirement.
    const response = await fetchWithTimeout(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw error;
    }

    return response.json();
  },

  // POST /auth/google — the credential is the GIS-issued ID token JWT
  // (Sprint 02A). Same credentials/header convention as register()/login().
  // Reuses AuthResponse: on success this is indistinguishable from a
  // password login/register response, so callers use the exact same
  // saveAuth()/navigate-by-role sequence.
  async googleLogin(credential: string): Promise<AuthResponse> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/auth/google`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ credential }),
    });

    if (!response.ok) {
      const error = await response.json();
      if (response.status === 409 && error?.code === 'ACCOUNT_LINK_REQUIRED') {
        throw new AccountLinkRequiredError(error.email, error.message);
      }
      throw error;
    }

    return response.json();
  },

  // POST /auth/google/link — confirms an account-link-required response by
  // proving the existing local account's password. `credential` is the same
  // GIS ID token googleLogin() was called with (valid ~1 hour).
  async confirmGoogleLink(
    credential: string,
    password: string,
  ): Promise<AuthResponse> {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/auth/google/link`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ credential, password }),
      },
    );

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw error;
    }

    return response.json();
  },

  // Best-effort, idempotent, always ends in the frontend being logged out —
  // consumes the Sprint 01A logout redesign, which is itself tolerant of a
  // missing/expired access token. Deliberately does NOT early-return when
  // there's no access token (the old behavior — see docs/memory.md H3):
  // the refresh cookie alone is enough for the backend to revoke the
  // session, and the backend's own logout is guard-free specifically so it
  // can be called in that case.
  //
  // Ordering matters: refreshCoordinator.cancelAll() runs synchronously as
  // the first statement (before any `await`), so any request currently
  // queued behind an in-flight refresh rejects immediately — no queued
  // retry can fire with credentials that are about to be cleared. Local
  // state is only cleared *after* the backend call is attempted, but is
  // ALWAYS cleared regardless of the outcome (network failure or a genuine
  // 503) — the frontend must never stay logged in because Redis is down.
  async logout(): Promise<LogoutResult> {
    refreshCoordinator.cancelAll();

    const token = localStorage.getItem('accessToken');
    const user = this.getUser();
    let degraded = false;

    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
      });
      // Any non-2xx here (in practice only ever a 503 — the backend logout
      // route always returns 200 otherwise, even for a stale/expired
      // token) means server-side revocation could not be confirmed.
      if (!response.ok) degraded = true;
    } catch {
      // Network failure reaching the backend at all — same treatment.
      degraded = true;
    }

    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');

    // Clear this student's local Continue Learning / video-resume state so
    // a shared device never surfaces it under the next logged-in account.
    // The per-user theme preference is deliberately NOT cleared — it stays
    // under its own scoped key so the same student keeps their choice on a
    // later login.
    if (user) {
      clearRecentActivity(user.id);
      clearAllVideoProgress(user.id);
    }

    emitAuthChanged();

    return { degraded };
  },

  // POST /auth/refresh — consumes the Sprint 01A rotating refresh cookie.
  // `credentials: 'include'` is what actually sends the httpOnly `emai_rt`
  // cookie; there is no token for the caller to pass explicitly. On success,
  // persists the new access token and fires AUTH_CHANGED_EVENT (the backend
  // response has no `user` field to update — see RefreshResponse above).
  // Only ever called by refreshCoordinator — never directly by apiFetch or
  // by a page — so it deliberately has no single-flight protection of its
  // own; that's the coordinator's job.
  async refresh(): Promise<RefreshResponse> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Refresh failed with status ${response.status}`);
    }

    const data: RefreshResponse = await response.json();
    localStorage.setItem('accessToken', data.accessToken);
    emitAuthChanged();
    return data;
  },

  saveAuth(response: AuthResponse): void {
    localStorage.setItem('accessToken', response.accessToken);
    localStorage.setItem('user', JSON.stringify(response.user));
    emitAuthChanged();
  },

  // Overwrites the stored user with a fresher copy (e.g. login/register's
  // follow-up getProfile() call, which fills in `avatarUrl` — a field
  // AuthResponse.user doesn't carry). Does not touch the access token.
  // Sprint 01B: this replaces a raw `localStorage.setItem('user', ...)`
  // that both forms used to do directly, which bypassed AUTH_CHANGED_EVENT.
  updateStoredUser(user: AuthResponse['user']): void {
    localStorage.setItem('user', JSON.stringify(user));
    emitAuthChanged();
  },

  getToken(): string | null {
    return localStorage.getItem('accessToken');
  },

  getUser(): AuthResponse['user'] | null {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      // Corrupt localStorage value — treat as logged out rather than crashing
      // route guards that read this at the app root.
      return null;
    }
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },

  // Clears local auth state only — does not call the backend or the
  // refresh coordinator. Used by apiError.ts's handleAuthError when a
  // session is confirmed unrecoverable (AuthExpiredError / a bare 401), and
  // available for any other forced-logout path that doesn't need the full
  // best-effort backend round trip logout() does.
  clearAuth(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    emitAuthChanged();
  },
};
