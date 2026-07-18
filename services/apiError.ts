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

// Shared 401/403 handling for admin data-fetching pages. Tokens live 10
// minutes with no refresh flow, so any page can hit an expired session
// mid-use; this keeps "clear auth + bounce to /login" in one place instead
// of being copy-pasted into every screen's .catch. Any other error is left
// to the caller to display as a normal message.
export const handleAuthError = (error: unknown, navigate: (path: string) => void): string => {
  const message = error instanceof Error ? error.message : 'Something went wrong';

  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
    authService.clearAuth();
    navigate('/login');
  }

  return message;
};
