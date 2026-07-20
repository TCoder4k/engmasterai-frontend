import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authService, AUTH_CHANGED_EVENT } from '../services/authService';

// Global light/dark theme, scoped per authenticated user. Tailwind runs in
// `darkMode: 'class'` (configured in index.html), and index.html also
// contains a pre-paint script applying the correct per-user preference to
// <html> before React mounts — that script prevents the initial theme
// flash; this provider stays in sync with it and handles toggling.
//
// Per-user scoping (fixes a real cross-account leak): the preference lives
// under `engmasterai:theme:<userId>`, not one global `theme` key, so on a
// shared/school browser Student A's dark mode never carries into Student B's
// session. Admins are always light — the admin UI is light-only by design
// (no admin theme toggle exists), so an admin never inherits a previous
// student's dark preference. Because a SPA login/logout navigates without
// remounting this provider, it re-resolves the theme on every
// AUTH_CHANGED_EVENT (login / logout / forced logout).

export type Theme = 'light' | 'dark';

const KEY_PREFIX = 'engmasterai:theme:';
const GUEST = 'guest';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const systemPrefersDark = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

const storageKeyForCurrentUser = (): string => {
  const user = authService.getUser();
  return KEY_PREFIX + (user?.id || GUEST);
};

// The effective theme for whoever is authenticated right now. Admin → always
// light. Student/guest → their own stored preference, else system default.
const resolveTheme = (): Theme => {
  const user = authService.getUser();
  if (user?.role === 'ADMIN') return 'light';

  try {
    const stored = localStorage.getItem(storageKeyForCurrentUser());
    if (stored === 'dark') return 'dark';
    if (stored === 'light') return 'light';
  } catch {
    // localStorage unavailable — fall through to system preference.
  }
  return systemPrefersDark() ? 'dark' : 'light';
};

// Persist under the current user's scoped key. Admins are forced light and
// have no toggle, so there's nothing to persist for them.
const persistTheme = (theme: Theme): void => {
  const user = authService.getUser();
  if (user?.role === 'ADMIN') return;
  try {
    localStorage.setItem(storageKeyForCurrentUser(), theme);
  } catch {
    // Persistence is best-effort; the in-memory theme still applies.
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(resolveTheme);

  // Apply the class and persist whenever the theme changes.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    persistTheme(theme);
  }, [theme]);

  // Re-resolve when the authenticated user changes — login/logout in a SPA
  // never remounts this provider, so without this the previous user's theme
  // would linger in memory for the next account on the same browser.
  useEffect(() => {
    const onAuthChanged = () => setTheme(resolveTheme());
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
