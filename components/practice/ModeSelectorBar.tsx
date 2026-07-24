import React from 'react';
import { Layers, Headphones, Gamepad2, PenLine } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { VocabPracticeMode } from './types';

interface ModeSelectorBarProps {
  activeMode: VocabPracticeMode;
  onSelect: (mode: VocabPracticeMode) => void;
}

// Contextual (fill-in-the-blank) stays disabled — deferred to its own
// checkpoint pending a small backend addition (word examples aren't on the
// deck word list yet). Never a dead link: shown disabled with a "Soon" cue,
// same convention as the sidebar/bottom-nav coming-soon items.
const ModeSelectorBar: React.FC<ModeSelectorBarProps> = ({ activeMode, onSelect }) => {
  const { t } = useTranslation();

  const modes: { id: VocabPracticeMode; label: string; icon: React.ReactNode; comingSoon?: boolean }[] = [
    { id: 'flashcard', label: t.practice.modeFlashcards, icon: <Layers size={16} /> },
    { id: 'dictation', label: t.practice.modeDictation, icon: <Headphones size={16} /> },
    { id: 'games', label: t.practice.modeGames, icon: <Gamepad2 size={16} /> },
    { id: 'contextual', label: t.practice.modeContextual, icon: <PenLine size={16} />, comingSoon: true },
  ];

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
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
            mode.comingSoon
              ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
              : activeMode === mode.id
                ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow'
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
