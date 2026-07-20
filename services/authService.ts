import { clearRecentActivity } from './recentActivity';
import { clearAllVideoProgress } from './videoProgress';

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

export const authService = {
  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
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
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
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

  async logout(): Promise<void> {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const user = this.getUser();

    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

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
  },

  saveAuth(response: AuthResponse): void {
    localStorage.setItem('accessToken', response.accessToken);
    localStorage.setItem('user', JSON.stringify(response.user));
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

  // Clears local auth state (used by handleAuthError on a 401/403 from any
  // admin data call, and available for any other forced-logout path).
  clearAuth(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    emitAuthChanged();
  },
};
