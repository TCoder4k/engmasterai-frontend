import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  TURNSTILE_SITE_KEY as SITE_KEY,
  TurnstileUnavailableError,
  renderTurnstile,
  resetTurnstile,
} from '../../services/turnstileWidget';

export interface TurnstileWidgetHandle {
  /** Forces a fresh solve — call after a failed register submit, since a
   * used/expired token cannot be resubmitted. */
  reset: () => void;
}

interface TurnstileWidgetProps {
  onToken: (token: string) => void;
  onExpire: () => void;
}

/**
 * Renders the Cloudflare Turnstile widget into a container this component
 * owns — same shape as GoogleSignInButton.tsx. Renders nothing at all when
 * VITE_TURNSTILE_SITE_KEY is unset, so the register form is completely
 * unaffected until Cloudflare is actually configured (see the rollout order
 * in docs/ — the frontend key must go live before the backend starts
 * requiring a token).
 */
export const TurnstileWidget = forwardRef<
  TurnstileWidgetHandle,
  TurnstileWidgetProps
>(({ onToken, onExpire }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  // Always the latest onToken/onExpire, read through a ref rather than as an
  // effect dependency — same reasoning as GoogleSignInButton.tsx's
  // onCredentialRef: a parent re-render (e.g. typing in another field)
  // recreates these callback props, and re-running the effect on every one
  // would wipe and re-render the widget, invalidating an in-progress solve.
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useImperativeHandle(ref, () => ({
    reset: () => resetTurnstile(widgetIdRef.current),
  }));

  useEffect(() => {
    if (!SITE_KEY) return;

    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    renderTurnstile(container, SITE_KEY, {
      callback: (token) => {
        if (!cancelled) onTokenRef.current(token);
      },
      'expired-callback': () => {
        if (!cancelled) onExpireRef.current();
      },
      'error-callback': () => {
        if (!cancelled) onExpireRef.current();
      },
    })
      .then((widgetId) => {
        if (!cancelled) widgetIdRef.current = widgetId;
      })
      .catch((err) => {
        if (!cancelled && err instanceof TurnstileUnavailableError) {
          setUnavailable(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!SITE_KEY || unavailable) return null;

  return <div ref={containerRef} data-testid="turnstile-container" className="my-2" />;
});

TurnstileWidget.displayName = 'TurnstileWidget';
