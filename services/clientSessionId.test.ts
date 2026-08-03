import { describe, expect, it, afterEach, vi } from 'vitest';
import { newUuidV4 } from './clientSessionId';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('newUuidV4', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a v4 uuid when crypto.randomUUID exists', () => {
    expect(newUuidV4()).toMatch(UUID_V4);
  });

  // THE NON-SECURE-CONTEXT CASE. crypto.randomUUID is undefined outside a
  // secure context, which is exactly what `http://192.168.x.x:5174` is — the
  // way this app is opened for mobile QA. Without a fallback, study-time
  // tracking would throw on precisely the devices the mobile pass uses.
  it('falls back to a valid v4 uuid when randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
    });

    const id = newUuidV4();

    // Must satisfy the SAME shape the backend DTO validates, or every heartbeat
    // from those devices would be a 400.
    expect(id).toMatch(UUID_V4);
  });

  it('falls back again when getRandomValues is also unavailable', () => {
    vi.stubGlobal('crypto', {});

    expect(newUuidV4()).toMatch(UUID_V4);
  });

  it('does not repeat itself', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newUuidV4()));

    expect(ids.size).toBe(200);
  });
});
