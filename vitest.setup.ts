import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

// LanguageProvider defaults to Vietnamese when localStorage has no stored
// choice yet (2026-08-20 — real users get 'vi' on a first visit). The whole
// existing suite was written asserting English strings without ever setting
// a language explicitly, silently riding on what used to be the
// implementation's own default — flipping it broke ~560 tests across ~50
// files at once. Pinning English here, once per test, keeps every one of
// those tests meaning what it already meant.
//
// A plain `beforeEach` here is not enough on its own: many test files ALSO
// call `localStorage.clear()` in their OWN beforeEach (to reset tokens/
// cached progress, unrelated to language), and that file-level hook runs
// AFTER this setup-file-level one — wiping the seed right back out. So
// `.clear()` itself is patched to always leave the language pinned,
// regardless of which file called it or why. A test that genuinely wants
// the true "nothing stored yet" state (LanguageProvider.test.tsx) uses
// `localStorage.removeItem('language')` instead, which this does not touch.
//
// Patched on `Storage.prototype`, not the `localStorage` instance —
// `Storage` is a legacy platform object whose own-property [[Set]] writes
// to actual storage entries instead of shadowing prototype methods, so
// `localStorage.clear = fn` silently does nothing (confirmed directly:
// `localStorage.clear` afterwards is still the native function). Patching
// the prototype avoids that entirely.
const nativeStorageClear = Storage.prototype.clear;
Storage.prototype.clear = function patchedClear(this: Storage) {
  nativeStorageClear.call(this);
  if (this === localStorage) {
    this.setItem('language', 'en');
  }
};

beforeEach(() => {
  localStorage.setItem('language', 'en');
});

// Sprint 06B.5 — jsdom has no layout engine and does not drive real
// animation frames the way a browser does, so framer-motion exit
// animations can leave AnimatePresence children mounted and hang any
// assertion waiting for them to disappear.
//
// Reporting prefers-reduced-motion makes MotionConfig reducedMotion="user"
// (App.tsx) resolve animations instantly under test. That is also the
// honest thing to test against: every test then exercises the
// reduced-motion path, which is precisely the path that must stay fully
// functional and fully legible with no motion at all.
// jsdom DEFINES window.scrollTo but its implementation only logs
// "Not implemented", so the stage-change scroll reset in LessonPage floods
// the test output. Overwritten unconditionally (an existence check would
// never fire) to keep that noise out without putting an environment check
// into application code.
Object.defineProperty(window, 'scrollTo', { writable: true, value: () => {} });

// jsdom does not implement IntersectionObserver, which framer-motion's
// `whileInView` (components/shared/motion/RevealOnScroll) needs. Without a
// stub the reveal never fires and every scroll-revealed section stays at
// opacity 0 — present in the DOM, so queries pass, but `toBeVisible()` and
// any visual assertion would not. This stub reports "already visible", which
// is the correct behaviour for a test with no viewport: the content must be
// readable, and nothing in this app may be reachable only through motion.
if (!('IntersectionObserver' in window)) {
  class ImmediateIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds: readonly number[] = [];

    constructor(private readonly callback: IntersectionObserverCallback) {}

    observe(target: Element): void {
      this.callback(
        [{ isIntersecting: true, target } as IntersectionObserverEntry],
        this,
      );
    }

    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    value: ImmediateIntersectionObserver,
  });
}

// Also absent from jsdom, and the landing page's nav anchors call it.
if (!Element.prototype.scrollIntoView) {
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    writable: true,
    value: () => {},
  });
}

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
