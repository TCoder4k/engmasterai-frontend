import React from 'react';
import { Star } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';

interface SaveWordStarProps {
  isSaved: boolean;
  isBusy?: boolean;
  onToggle: () => void;
  size?: number;
  className?: string;
  /**
   * 'button' (default) renders a real `<button>`. Pass 'span' when nesting
   * inside another interactive element would create invalid nested-button
   * markup — e.g. FlashcardSession's flip-card front face is ITSELF a
   * `<button>`. The 'span' variant mirrors the exact role="button" +
   * tabIndex + Enter/Space + stopPropagation workaround this codebase's own
   * audio-play control already uses in that same spot (FlashcardSession.tsx).
   */
  as?: 'button' | 'span';
}

// The universal "save to My Vocabulary" star — one visual rule everywhere it
// appears (Dictionary panel, deck/word-detail pages, Flashcard practice, the
// My Vocabulary list itself): gray outline = not saved, filled amber =
// saved. Visually matches the treatment DictionaryPanel.tsx already had
// before this component existed (that one was visual-only; this one is
// real). `aria-pressed` + a shared aria-label pair (t.myVocab.saveWord /
// unsaveWord) so it reads the same to assistive tech on every surface too.
const SaveWordStar: React.FC<SaveWordStarProps> = ({
  isSaved,
  isBusy = false,
  onToggle,
  size = 16,
  className = '',
  as = 'button',
}) => {
  const { t } = useTranslation();
  const label = isSaved ? t.myVocab.unsaveWord : t.myVocab.saveWord;
  const sharedClasses = `shrink-0 text-slate-300 dark:text-slate-600 hover:text-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded disabled:opacity-50 disabled:cursor-wait ${
    isSaved ? 'text-amber-400' : ''
  } ${className}`;
  const icon = (
    <Star size={size} fill={isSaved ? 'currentColor' : 'none'} className={isSaved ? 'text-amber-400' : ''} />
  );

  if (as === 'span') {
    return (
      <span
        role="button"
        tabIndex={isBusy ? -1 : 0}
        aria-pressed={isSaved}
        aria-disabled={isBusy}
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          if (!isBusy) onToggle();
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.stopPropagation();
          e.preventDefault();
          if (!isBusy) onToggle();
        }}
        className={`${sharedClasses} cursor-pointer`}
      >
        {icon}
      </span>
    );
  }

  return (
    <button type="button" onClick={onToggle} disabled={isBusy} aria-pressed={isSaved} aria-label={label} className={sharedClasses}>
      {icon}
    </button>
  );
};

export default SaveWordStar;
