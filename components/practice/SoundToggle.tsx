import React, { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { isMuted, setMuted } from '../../services/feedbackSounds';

// Mute toggle for the practice feedback sounds (Sprint 03E). Sound is an
// enhancement — visual feedback always remains — so this only gates the
// feedbackSounds service, not TTS/word audio playback.
const SoundToggle: React.FC = () => {
  const { t } = useTranslation();
  const [muted, setMutedState] = useState(isMuted);

  const toggle = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={muted}
      aria-label={muted ? t.practice.unmuteSounds : t.practice.muteSounds}
      title={muted ? t.practice.unmuteSounds : t.practice.muteSounds}
      className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
    >
      {muted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
    </button>
  );
};

export default SoundToggle;
