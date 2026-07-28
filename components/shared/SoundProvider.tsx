import React, { createContext, useCallback, useContext, useState } from 'react';
import { isMuted as readMuted, setMuted as persistMuted } from '../../services/feedbackSounds';

interface SoundContextValue {
  muted: boolean;
  toggleMuted: () => void;
}

const SoundContext = createContext<SoundContextValue | null>(null);

// Sprint 06B.5 — sound is now app-wide (lesson quiz + practice), so the
// mute toggle renders in the global student chrome AND, on some screens,
// beside a session. Two <SoundToggle/>s reading their own useState would
// drift the moment one was clicked, so the preference lives in one context
// — the same shape ThemeProvider already uses for the theme.
//
// The value is still persisted device-level by services/feedbackSounds.ts;
// this provider only keeps React in sync with it.
export const SoundProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [muted, setMutedState] = useState(readMuted);

  const toggleMuted = useCallback(() => {
    setMutedState((prev) => {
      const next = !prev;
      persistMuted(next);
      return next;
    });
  }, []);

  return (
    <SoundContext.Provider value={{ muted, toggleMuted }}>
      {children}
    </SoundContext.Provider>
  );
};

// Falls back to reading the stored preference directly when no provider is
// mounted, so a component rendered in isolation (a test, a future embedded
// widget) still behaves correctly instead of throwing.
export const useSound = (): SoundContextValue => {
  const ctx = useContext(SoundContext);
  if (ctx) return ctx;
  return {
    muted: readMuted(),
    toggleMuted: () => persistMuted(!readMuted()),
  };
};
