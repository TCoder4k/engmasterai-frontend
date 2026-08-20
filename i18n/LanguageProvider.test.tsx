import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { LanguageProvider } from './LanguageProvider';
import { useTranslation } from './useTranslation';

// The onboarding-page mismatch this pins: a fresh session (no
// localStorage['language'] yet, e.g. a first-time visitor or a private
// window) must default to Vietnamese, not English — this file's own
// default silently regressed to 'en' once already (see docs/memory.md,
// 2026-08-20).

const Probe: React.FC = () => {
  const { language, setLanguage } = useTranslation();
  return (
    <div>
      <span data-testid="language">{language}</span>
      <button onClick={() => setLanguage('en')}>switch to en</button>
    </div>
  );
};

describe('LanguageProvider', () => {
  // removeItem, not clear() — vitest.setup.ts patches clear() to always
  // leave a language pinned (so the rest of the suite keeps its implicit
  // English assumption), which would defeat these very tests.
  beforeEach(() => {
    localStorage.removeItem('language');
  });

  afterEach(() => {
    cleanup();
    localStorage.removeItem('language');
  });

  it('defaults to Vietnamese when nothing is stored yet', () => {
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );

    expect(screen.getByTestId('language')).toHaveTextContent('vi');
    expect(document.documentElement.lang).toBe('vi');
  });

  it('respects an explicitly stored language over the default', () => {
    localStorage.setItem('language', 'en');

    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );

    expect(screen.getByTestId('language')).toHaveTextContent('en');
  });

  it('setLanguage updates state and persists the choice', () => {
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );

    fireEvent.click(screen.getByText('switch to en'));

    expect(screen.getByTestId('language')).toHaveTextContent('en');
    expect(localStorage.getItem('language')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('ignores a garbage stored value and falls back to Vietnamese', () => {
    localStorage.setItem('language', 'fr');

    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );

    expect(screen.getByTestId('language')).toHaveTextContent('vi');
  });
});
