import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, act } from '@testing-library/react';
import { GoogleSignInButton } from './GoogleSignInButton';
import * as googleAuth from '../../services/googleAuth';

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
