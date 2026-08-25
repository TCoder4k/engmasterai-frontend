// Cloudflare Turnstile bridge (2026-08-25) — mirrors services/googleAuth.ts's
// poll-for-global/render pattern. Added to /register after a bot created 330
// fake accounts in one day by rotating source IPs, bypassing the existing
// per-IP rate limits.
import type { TurnstileRenderOptions } from '../types/turnstile';

// Single source of truth for whether Turnstile is configured — read once
// here so TurnstileWidget.tsx (whether to render at all) and RegisterForm.tsx
// (whether to require a token before enabling submit) never disagree.
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as
  | string
  | undefined;

const TURNSTILE_READY_TIMEOUT_MS = 8000;
const TURNSTILE_READY_POLL_INTERVAL_MS = 100;

export class TurnstileUnavailableError extends Error {
  constructor(message = 'CAPTCHA is currently unavailable') {
    super(message);
    this.name = 'TurnstileUnavailableError';
  }
}

let readyPromise: Promise<void> | null = null;

function waitForTurnstileReady(): Promise<void> {
  if (readyPromise) return readyPromise;

  readyPromise = new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve();
      return;
    }

    const startedAt = Date.now();
    const poll = () => {
      if (window.turnstile) {
        resolve();
        return;
      }
      if (Date.now() - startedAt > TURNSTILE_READY_TIMEOUT_MS) {
        reject(new TurnstileUnavailableError());
        return;
      }
      setTimeout(poll, TURNSTILE_READY_POLL_INTERVAL_MS);
    };
    poll();
  });

  return readyPromise;
}

/** Renders a Turnstile widget into `container`, returning its widget id
 * (needed for resetTurnstile after a failed submit — a solved token is
 * single-use and short-lived). Safe to call repeatedly on the same element,
 * same as renderGoogleButton. */
export async function renderTurnstile(
  container: HTMLElement,
  sitekey: string,
  options: Pick<
    TurnstileRenderOptions,
    'callback' | 'expired-callback' | 'error-callback'
  >,
): Promise<string> {
  await waitForTurnstileReady();
  container.replaceChildren();
  return window.turnstile!.render(container, { sitekey, ...options });
}

/** Forces a fresh solve — required after a failed register submit, since a
 * used or expired Turnstile token cannot be resubmitted. No-op if the
 * script never loaded (e.g. the widget was never configured). */
export function resetTurnstile(widgetId: string | null): void {
  if (widgetId) window.turnstile?.reset(widgetId);
}
