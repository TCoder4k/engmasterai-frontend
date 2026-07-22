import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiError, AuthExpiredError, handleAuthError } from './apiError';
import { authService } from './authService';

describe('handleAuthError — the global 401 handler', () => {
  let navigate: (path: string) => void;
  let clearAuthSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    navigate = vi.fn<(path: string) => void>();
    clearAuthSpy = vi.spyOn(authService, 'clearAuth').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clears auth and redirects on AuthExpiredError (an authenticated session that failed to refresh)', () => {
    handleAuthError(new AuthExpiredError(), navigate);
    expect(clearAuthSpy).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('clears auth and redirects on a bare ApiError with status 401', () => {
    handleAuthError(new ApiError('Unauthorized', 401), navigate);
    expect(clearAuthSpy).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('does NOT clear auth or redirect on a 403 (Invalid credentials — e.g. a wrong linking password)', () => {
    handleAuthError(new ApiError('Invalid credentials', 403), navigate);
    expect(clearAuthSpy).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does NOT clear auth or redirect on a 429 (rate limited)', () => {
    handleAuthError(new ApiError('Too many requests. Please try again later.', 429), navigate);
    expect(clearAuthSpy).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does NOT clear auth or redirect on a 503 (service unavailable)', () => {
    handleAuthError(new ApiError('Service unavailable', 503), navigate);
    expect(clearAuthSpy).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does NOT clear auth or redirect on a plain Error with no status (e.g. a credential-entry endpoint\'s raw thrown body)', () => {
    handleAuthError(new Error('Google sign-in failed'), navigate);
    expect(clearAuthSpy).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('returns the error message regardless of whether the session was cleared', () => {
    const message = handleAuthError(new ApiError('Invalid credentials', 403), navigate);
    expect(message).toBe('Invalid credentials');
  });
});
