import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authService } from './authService';
import * as googleAuth from './googleAuth';

// Regression coverage for the missing disableGoogleAutoSelect() call: without
// it, GIS keeps remembering the previous account for this origin and keeps
// rendering the Sign-In button in its "Personalized" (avatar + name) state
// even after our own app has logged the user out — Google's own docs call
// this a "UX dead loop". See googleAuth.ts's disableGoogleAutoSelect doc
// comment for the full citation.
describe('authService.logout — Google auto-select reset', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls disableGoogleAutoSelect on a successful backend logout', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;
    const spy = vi
      .spyOn(googleAuth, 'disableGoogleAutoSelect')
      .mockImplementation(() => {});

    await authService.logout();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('still calls disableGoogleAutoSelect and clears local state when the backend logout call fails (degraded logout)', async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new Error('network error')) as unknown as typeof fetch;
    localStorage.setItem('accessToken', 'tok');
    const spy = vi
      .spyOn(googleAuth, 'disableGoogleAutoSelect')
      .mockImplementation(() => {});

    const result = await authService.logout();

    expect(result.degraded).toBe(true);
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
