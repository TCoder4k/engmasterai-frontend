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
