import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { postStudyHeartbeat, StudyHeartbeatBody } from './studyTimeService';

const BODY: StudyHeartbeatBody = {
  clientSessionId: '11111111-1111-4111-8111-111111111111',
  sequence: 0,
  activityType: 'QUIZ',
  activityId: 'lesson-1',
  activeSeconds: 60,
};

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('postStudyHeartbeat', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('accessToken', 'token-abc');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  // The FOREGROUND path is the opposite of the beacon: it should behave like
  // every other authenticated call in the app, refresh included.
  it('goes through apiFetch, carrying the bearer token', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(201, { acceptedSeconds: 60 }));

    await postStudyHeartbeat(BODY);

    const [, init] = (
      global.fetch as unknown as { mock: { calls: [string, RequestInit][] } }
    ).mock.calls[0];
    expect(new Headers(init.headers).get('Authorization')).toBe(
      'Bearer token-abc',
    );
    // apiFetch always sends credentials; the beacon never does.
    expect(init.credentials).toBe('include');
  });

  it('returns the SERVER’s accepted seconds, not what was sent', async () => {
    // 0 is a legitimate answer — a replay, or a day at its ceiling — and the
    // client must not "correct" it back to what it asked for.
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(201, { acceptedSeconds: 0 }));

    await expect(postStudyHeartbeat(BODY)).resolves.toEqual({
      acceptedSeconds: 0,
    });
  });

  it('throws on a non-ok response so the caller can re-buffer', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(429, {}));

    await expect(postStudyHeartbeat(BODY)).rejects.toBeTruthy();
  });

  it('retries once through the refresh path on a 401', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'token-def' }))
      .mockResolvedValueOnce(jsonResponse(201, { acceptedSeconds: 60 }));

    await expect(postStudyHeartbeat(BODY)).resolves.toEqual({
      acceptedSeconds: 60,
    });
  });
});
