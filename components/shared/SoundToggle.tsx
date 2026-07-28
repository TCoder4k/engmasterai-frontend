import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useSound } from './SoundProvider';

// Mute toggle for the app's feedback sounds (Sprint 03E; promoted out of
// components/practice/ in Sprint 06B.5, when the lesson quiz started using
// them too). Sound is an enhancement — visual feedback always remains — so
// this only gates the feedbackSounds service, not TTS or word/lesson audio
// playback.
//
// State comes from SoundProvider rather than local useState: with a toggle
// now in the global chrome AND one beside a listening session, two local
// copies would drift the moment either was clicked.
const SoundToggle: React.FC = () => {
  const { t } = useTranslation();
  const { muted, toggleMuted } = useSound();

  return (
    <button
      type="button"
      onClick={toggleMuted}
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
