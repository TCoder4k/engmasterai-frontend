// Google Identity Services (GIS) bridge (Sprint 02A). Uses the OFFICIAL
// google.accounts.id.renderButton() flow, not google.accounts.id.prompt()
// — prompt() is the One Tap/FedCM API, not a programmatic replacement for
// the Sign-In button flow, and is not used anywhere in this file. No
// transparent overlay, no synthetic clicks on a hidden GIS element: the
// GIS-rendered button (mounted by components/auth/GoogleSignInButton.tsx)
// is the real, visible click target.
import type { GoogleButtonConfiguration } from '../types/google-identity';

const GIS_READY_TIMEOUT_MS = 8000;
const GIS_READY_POLL_INTERVAL_MS = 100;

export class GoogleSignInUnavailableError extends Error {
  constructor(message = 'Google sign-in is currently unavailable') {
    super(message);
    this.name = 'GoogleSignInUnavailableError';
  }
}

// Module-scoped GIS state — deliberately NOT React state. GIS is
// initialize()-d at most once per page load (the script itself doesn't
// support being initialized twice with different callbacks in any useful
// way); which component instance receives the next credential is
// controlled separately via `activeHandler`, which every mounted
// GoogleSignInButton registers/unregisters itself. This is what makes a
// remount (or navigating login -> register) safe: it swaps the handler, it
// never re-runs initialize().
let readyPromise: Promise<void> | null = null;
let initialized = false;
let activeHandler: ((credential: string) => void) | null = null;

function waitForGisReady(): Promise<void> {
  if (readyPromise) return readyPromise;

  readyPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const startedAt = Date.now();
    const poll = () => {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }
      if (Date.now() - startedAt > GIS_READY_TIMEOUT_MS) {
        reject(new GoogleSignInUnavailableError());
        return;
      }
      setTimeout(poll, GIS_READY_POLL_INTERVAL_MS);
    };
    poll();
  });

  return readyPromise;
}

function ensureInitialized(clientId: string): void {
  if (initialized) return;
  // Non-null: waitForGisReady() already resolved before this is ever called.
  window.google!.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => activeHandler?.(response.credential),
    auto_select: false,
  });
  initialized = true;
}

/** Registers the handler that receives the next credential GIS delivers.
 * Exactly one handler is active at a time — the currently-mounted
 * GoogleSignInButton's. Pass `null` on unmount. */
export function setGoogleCredentialHandler(
  handler: ((credential: string) => void) | null,
): void {
  activeHandler = handler;
}

/** Renders (or re-renders) the GIS button into `container`. Safe to call
 * repeatedly on the same element (e.g. on a container resize) — GIS paints
 * fresh into whatever is currently in the container each time. */
export async function renderGoogleButton(
  container: HTMLElement,
  clientId: string,
  options: GoogleButtonConfiguration,
): Promise<void> {
  await waitForGisReady();
  ensureInitialized(clientId);
  container.replaceChildren();
  window.google!.accounts.id.renderButton(container, options);
}
