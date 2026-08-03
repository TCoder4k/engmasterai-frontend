import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendStudyBeacon } from './studyTimeBeacon';
import { authService } from './authService';
import * as apiFetchModule from './apiFetch';
import { refreshCoordinator } from './refreshCoordinator';
import type { StudyHeartbeatBody } from './studyTimeService';

// Sprint 10.5 — the properties that make the unload flush SAFE, not the ones
// that make it work. Every assertion here is about something the beacon must
// NOT do, because each one is a way to sign a student out of their account.

const BODY: StudyHeartbeatBody = {
  clientSessionId: '11111111-1111-4111-8111-111111111111',
  sequence: 3,
  activityType: 'THEORY',
  activeSeconds: 42,
};

describe('sendStudyBeacon', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('accessToken', 'token-abc');
    global.fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  const lastCall = () =>
    (global.fetch as unknown as { mock: { calls: [string, RequestInit][] } })
      .mock.calls[0];

  it('posts the heartbeat with the current bearer token', () => {
    sendStudyBeacon(BODY);

    const [url, init] = lastCall();
    expect(url).toContain('/study-time/heartbeat');
    expect(init.method).toBe('POST');
    expect(
      (init.headers as Record<string, string>).Authorization,
    ).toBe('Bearer token-abc');
    expect(JSON.parse(init.body as string)).toEqual(BODY);
  });

  it('sets keepalive so the request outlives the document', () => {
    sendStudyBeacon(BODY);

    expect(lastCall()[1].keepalive).toBe(true);
  });

  // fetchWithTimeout attaches an AbortController to every request it makes. A
  // timer living in a document being torn down must not decide the fate of the
  // one request designed to outlive it.
  it('attaches NO AbortController signal', () => {
    sendStudyBeacon(BODY);

    expect(lastCall()[1].signal).toBeUndefined();
  });

  // THE REASON THIS MODULE EXISTS. apiFetch refreshes on 401, and this app's
  // refresh tokens are single-use and rotating. A refresh started at pagehide
  // rotates server-side while the client never persists the replacement — the
  // student is signed out on their next visit. Losing one minute is fine;
  // losing the session is not.
  it('never routes through apiFetch', () => {
    const apiFetchSpy = vi.spyOn(apiFetchModule, 'apiFetch');

    sendStudyBeacon(BODY);

    expect(apiFetchSpy).not.toHaveBeenCalled();
  });

  it('never triggers a token refresh, even on a 401', async () => {
    const refreshSpy = vi.spyOn(refreshCoordinator, 'refresh');
    global.fetch = vi.fn().mockResolvedValue(new Response('', { status: 401 }));

    sendStudyBeacon(BODY);
    await Promise.resolve();

    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('never retries', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('', { status: 500 }));

    sendStudyBeacon(BODY);
    await Promise.resolve();

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not clear auth state when the request fails', async () => {
    const clearSpy = vi.spyOn(authService, 'clearAuth');
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'));

    sendStudyBeacon(BODY);
    await Promise.resolve();

    expect(clearSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem('accessToken')).toBe('token-abc');
  });

  it('sends nothing when there is no token', () => {
    localStorage.removeItem('accessToken');

    sendStudyBeacon(BODY);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('never throws, even if fetch throws synchronously', () => {
    global.fetch = vi.fn(() => {
      throw new Error('cannot queue during unload');
    }) as unknown as typeof fetch;

    expect(() => sendStudyBeacon(BODY)).not.toThrow();
  });
});
