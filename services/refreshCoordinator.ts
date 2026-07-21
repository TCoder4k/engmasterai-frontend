import { authService } from './authService';
import { AuthExpiredError } from './apiError';

// The single owner of refresh concurrency (Sprint 01B). apiFetch calls
// `refreshCoordinator.refresh()` whenever it sees a 401; this class makes
// sure concurrent callers share one real `/auth/refresh` request instead of
// each firing their own (which would race against Sprint 01A's strict
// single-use rotation and revoke the whole session).
//
// Single-flight + queue: refresh() returns the same in-flight promise to
// every caller until it settles — a promise naturally fans out to all its
// awaiters, so no separate waiter array is needed for the happy path.
//
// Cancellation: a plain Promise can't be force-rejected from outside once
// created, so every caller actually awaits `Promise.race([inFlight,
// cancelSignal])`. cancelAll() rejects the current `cancelSignal` (settling
// that race for every current waiter, even ones started before cancelAll()
// was called) and swaps in a fresh one, so a later refresh() starts clean
// and a refresh that happens to resolve *after* cancelAll() can never
// resurrect an already-rejected waiter (a settled promise cannot change
// state again).
//
// Extension point: this class boundary is where a future cross-tab
// coordination mechanism (BroadcastChannel) or a proactive background
// refresh (started before the access token actually expires) would plug
// in — not built this sprint (see docs/memory.md Known Technical Debt).
class RefreshCoordinator {
  private inFlight: Promise<void> | null = null;
  private cancelSignal: Promise<never> = this.createCancelSignal();
  private rejectCancelSignal: (reason: unknown) => void = () => {};

  private createCancelSignal(): Promise<never> {
    const signal = new Promise<never>((_, reject) => {
      this.rejectCancelSignal = reject;
    });
    // cancelAll() rejects this even when nothing is currently racing it
    // (the common case — most logouts happen with no refresh in flight).
    // Without this handler, that rejection is unobserved and both browsers
    // and Node report it as an unhandled promise rejection on every such
    // logout. Promise.race() below still races the same promise object
    // fine; attaching a handler here doesn't prevent that.
    signal.catch(() => {});
    return signal;
  }

  refresh(): Promise<void> {
    if (!this.inFlight) {
      const attempt = authService
        .refresh()
        .then(() => undefined)
        .catch((error: unknown) => {
          throw error instanceof AuthExpiredError ? error : new AuthExpiredError();
        });

      this.inFlight = attempt;

      // Clear only if nothing newer (a cancellation, or another refresh
      // cycle) has already replaced this attempt.
      attempt.finally(() => {
        if (this.inFlight === attempt) this.inFlight = null;
      }).catch(() => {
        // The rejection itself is already observed by every racer below;
        // this second .catch only exists so Node/the browser never reports
        // this internal bookkeeping promise as an unhandled rejection.
      });
    }

    return Promise.race([this.inFlight, this.cancelSignal]);
  }

  // Called by authService.logout(): rejects every request currently
  // waiting on a refresh and guarantees no queued retry can fire once local
  // session state is gone.
  cancelAll(): void {
    this.rejectCancelSignal(new AuthExpiredError('Session ended'));
    this.cancelSignal = this.createCancelSignal();
    this.inFlight = null;
  }
}

export const refreshCoordinator = new RefreshCoordinator();
