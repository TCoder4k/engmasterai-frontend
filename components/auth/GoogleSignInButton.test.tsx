import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, act } from '@testing-library/react';
import type { GoogleSignInButton as GoogleSignInButtonComponent } from './GoogleSignInButton';
import type * as GoogleAuthModule from '../../services/googleAuth';

// Phase 11 production incident regression coverage.
//
// renderGoogleButton() injects a GIS iframe that resizes itself
// ASYNCHRONOUSLY once Google's server responds — a mutation of the very
// container the component's own ResizeObserver watches. Before the fix, any
// observed size change unconditionally re-triggered render(), which wiped
// and re-rendered the iframe, which resized again: an unbounded
// render -> resize -> render loop hammering accounts.google.com. These
// tests drive the ResizeObserver callback directly (jsdom has no real
// layout engine, so nothing does this on its own) and assert
// renderGoogleButton's call count under both an unchanged-width firing
// (must NOT re-render) and a genuinely different width (must re-render
// exactly once more) — proving the loop is broken without breaking the
// original responsive-width feature.
//
// GoogleSignInButton reads import.meta.env.VITE_GOOGLE_CLIENT_ID into a
// MODULE-LEVEL constant, evaluated exactly once, the moment the module is
// first imported — before any beforeEach/vi.stubEnv in a test file could
// possibly run. Locally that variable comes from .env.local (gitignored,
// developer-machine-only); CI's clean checkout has no such file, so the
// constant silently resolves to undefined there, and the component's
// `if (!CLIENT_ID) return` guard short-circuits the whole effect — every
// assertion below that expects renderGoogleButton to have been called
// deterministically saw 0 calls in CI while passing locally (reproduced
// exactly by temporarily hiding .env.local and re-running this file).
// A static top-level `import` is hoisted and evaluated before ANY of this
// file's own top-level code — including a `vi.stubEnv` call placed after
// it — so the only way to control CLIENT_ID is to stub the env var FIRST
// and then import the component (and the service module it reads GIS
// through) dynamically, once, in beforeAll.
vi.stubEnv(
  'VITE_GOOGLE_CLIENT_ID',
  'test-client-id.apps.googleusercontent.com',
);

let GoogleSignInButton: typeof GoogleSignInButtonComponent;
let googleAuth: typeof GoogleAuthModule;

let resizeCallback: ResizeObserverCallback | null = null;

class MockResizeObserver implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback;
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {
    resizeCallback = null;
  }
}

const setContainerWidth = (width: number) => {
  const container = screen.getByTestId('google-signin-container');
  Object.defineProperty(container, 'clientWidth', {
    configurable: true,
    value: width,
  });
};

const fireResize = async () => {
  const callback = resizeCallback;
  await act(async () => {
    callback?.([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
    // Flush the 200ms debounce inside the observer's handler.
    await vi.advanceTimersByTimeAsync(250);
  });
};

describe('GoogleSignInButton', () => {
  beforeAll(async () => {
    ({ GoogleSignInButton } = await import('./GoogleSignInButton'));
    googleAuth = await import('../../services/googleAuth');
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    resizeCallback = null;
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    vi.spyOn(googleAuth, 'renderGoogleButton').mockResolvedValue(undefined);
    vi.spyOn(googleAuth, 'setGoogleCredentialHandler').mockImplementation(
      () => {},
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders exactly once on mount', async () => {
    render(<GoogleSignInButton text="continue_with" onCredential={() => {}} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(googleAuth.renderGoogleButton).toHaveBeenCalledTimes(1);
  });

  it('does not re-render when a ResizeObserver firing reports an unchanged width (the GIS self-resize loop)', async () => {
    render(<GoogleSignInButton text="continue_with" onCredential={() => {}} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(googleAuth.renderGoogleButton).toHaveBeenCalledTimes(1);

    // Simulate GIS's own async iframe self-resize firing the observer
    // several times in a row with the SAME width the component last
    // measured — exactly what happened in production.
    setContainerWidth(400);
    await fireResize();
    await fireResize();
    await fireResize();

    expect(googleAuth.renderGoogleButton).toHaveBeenCalledTimes(1);
  });

  it('re-renders exactly once when the container width genuinely changes', async () => {
    render(<GoogleSignInButton text="continue_with" onCredential={() => {}} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(googleAuth.renderGoogleButton).toHaveBeenCalledTimes(1);

    setContainerWidth(280);
    await fireResize();

    expect(googleAuth.renderGoogleButton).toHaveBeenCalledTimes(2);

    // Firing again at that SAME new width must not cause a third call.
    await fireResize();
    expect(googleAuth.renderGoogleButton).toHaveBeenCalledTimes(2);
  });

  it('never calls setGoogleCredentialHandler or renderGoogleButton more than once for repeated React re-renders with the same props', async () => {
    const { rerender } = render(
      <GoogleSignInButton text="continue_with" onCredential={() => {}} />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    rerender(<GoogleSignInButton text="continue_with" onCredential={() => {}} />);
    rerender(<GoogleSignInButton text="continue_with" onCredential={() => {}} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(googleAuth.renderGoogleButton).toHaveBeenCalledTimes(1);
    expect(googleAuth.setGoogleCredentialHandler).toHaveBeenCalledTimes(1);
  });
});
