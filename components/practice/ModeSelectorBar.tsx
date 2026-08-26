import React from 'react';
import { Layers, HelpCircle, Headphones, Gamepad2, PenLine } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { TranslationDict } from '../../i18n/translations';
import { VocabPracticeMode } from './types';

interface ModeSelectorBarProps {
  activeMode: VocabPracticeMode;
  onSelect: (mode: VocabPracticeMode) => void;
}

// The single source of truth for tab order — VocabPracticeSessionPage reuses
// this (not the ?mode= validation list in VALID_PRACTICE_MODES, which is
// unordered) to work out "next tab" for its post-session shortcut, so the
// two never drift apart.
export const PRACTICE_MODE_ORDER: VocabPracticeMode[] = [
  'flashcard',
  'guess',
  'games',
  'contextual',
  'dictation',
];

export const practiceModeLabel = (mode: VocabPracticeMode, t: TranslationDict): string => {
  switch (mode) {
    case 'flashcard':
      return t.practice.modeFlashcards;
    case 'guess':
      return t.practice.modeGuess;
    case 'games':
      return t.practice.modeGames;
    case 'contextual':
      return t.practice.modeContextual;
    case 'dictation':
      return t.practice.modeDictation;
  }
};

// All five modes are live. `comingSoon` stays supported in the shape below
// (never a dead link, shown disabled with a "Soon" cue) for whatever the
// next one turns out to be — it just isn't set on any entry right now.
const ModeSelectorBar: React.FC<ModeSelectorBarProps> = ({ activeMode, onSelect }) => {
  const { t } = useTranslation();

  const icons: Record<VocabPracticeMode, React.ReactNode> = {
    flashcard: <Layers size={16} />,
    guess: <HelpCircle size={16} />,
    games: <Gamepad2 size={16} />,
    contextual: <PenLine size={16} />,
    dictation: <Headphones size={16} />,
  };
  const modes: { id: VocabPracticeMode; label: string; icon: React.ReactNode; comingSoon?: boolean }[] =
    PRACTICE_MODE_ORDER.map((id) => ({ id, label: practiceModeLabel(id, t), icon: icons[id] }));

  return (
    <div
      role="tablist"
      className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-x-auto"
    >
      {modes.map((mode) => (
        <button
          key={mode.id}
          type="button"
          role="tab"
          aria-selected={activeMode === mode.id}
          disabled={mode.comingSoon}
          title={mode.comingSoon ? t.practice.comingSoonMode : undefined}
          onClick={() => !mode.comingSoon && onSelect(mode.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
            mode.comingSoon
              ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
              : activeMode === mode.id
                ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          {mode.icon}
          <span>{mode.label}</span>
          {mode.comingSoon && (
            <span className="text-[9px] font-bold uppercase bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 px-1.5 py-0.5 rounded-md">
              {t.common.soon}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

export default ModeSelectorBar;
