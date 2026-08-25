import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { createRef } from 'react';
import { render, cleanup, screen, act } from '@testing-library/react';
import type {
  TurnstileWidget as TurnstileWidgetComponent,
  TurnstileWidgetHandle,
} from './TurnstileWidget';
import type * as TurnstileModule from '../../services/turnstileWidget';

// Same reasoning as GoogleSignInButton.test.tsx: TurnstileWidget reads
// TURNSTILE_SITE_KEY (re-exported from services/turnstileWidget.ts) into a
// MODULE-LEVEL constant, evaluated once at import time — a vi.stubEnv after
// a static top-level import would be too late. Stub first, then dynamically
// import both modules once in beforeAll.
vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-site-key');

let TurnstileWidget: typeof TurnstileWidgetComponent;
let turnstileService: typeof TurnstileModule;

describe('TurnstileWidget', () => {
  beforeAll(async () => {
    ({ TurnstileWidget } = await import('./TurnstileWidget'));
    turnstileService = await import('../../services/turnstileWidget');
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders a container and calls renderTurnstile with the configured site key', async () => {
    vi.spyOn(turnstileService, 'renderTurnstile').mockResolvedValue('widget-1');

    render(<TurnstileWidget onToken={() => {}} onExpire={() => {}} />);
    await act(async () => {});

    expect(screen.getByTestId('turnstile-container')).toBeInTheDocument();
    expect(turnstileService.renderTurnstile).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      'test-site-key',
      expect.objectContaining({
        callback: expect.any(Function),
        'expired-callback': expect.any(Function),
        'error-callback': expect.any(Function),
      }),
    );
  });

  it('calls onToken with the solved token when Turnstile\'s callback fires', async () => {
    let capturedCallback: ((token: string) => void) | undefined;
    vi.spyOn(turnstileService, 'renderTurnstile').mockImplementation(
      async (_container, _sitekey, options) => {
        capturedCallback = options.callback;
        return 'widget-1';
      },
    );
    const onToken = vi.fn();

    render(<TurnstileWidget onToken={onToken} onExpire={() => {}} />);
    await act(async () => {});

    act(() => capturedCallback?.('solved-token'));

    expect(onToken).toHaveBeenCalledWith('solved-token');
  });

  it('calls onExpire when Turnstile\'s expired-callback fires', async () => {
    let capturedExpire: (() => void) | undefined;
    vi.spyOn(turnstileService, 'renderTurnstile').mockImplementation(
      async (_container, _sitekey, options) => {
        capturedExpire = options['expired-callback'];
        return 'widget-1';
      },
    );
    const onExpire = vi.fn();

    render(<TurnstileWidget onToken={() => {}} onExpire={onExpire} />);
    await act(async () => {});

    act(() => capturedExpire?.());

    expect(onExpire).toHaveBeenCalled();
  });

  it('exposes an imperative reset() that forwards to resetTurnstile with this widget\'s id', async () => {
    vi.spyOn(turnstileService, 'renderTurnstile').mockResolvedValue('widget-42');
    const resetSpy = vi
      .spyOn(turnstileService, 'resetTurnstile')
      .mockImplementation(() => {});
    const ref = createRef<TurnstileWidgetHandle>();

    render(<TurnstileWidget ref={ref} onToken={() => {}} onExpire={() => {}} />);
    await act(async () => {});

    ref.current?.reset();

    expect(resetSpy).toHaveBeenCalledWith('widget-42');
  });
});
