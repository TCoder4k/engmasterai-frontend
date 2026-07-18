
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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

    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
  },

  saveAuth(response: AuthResponse): void {
    localStorage.setItem('accessToken', response.accessToken);
    localStorage.setItem('user', JSON.stringify(response.user));
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
  },
};
