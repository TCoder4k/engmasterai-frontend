import '@testing-library/jest-dom/vitest';

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
