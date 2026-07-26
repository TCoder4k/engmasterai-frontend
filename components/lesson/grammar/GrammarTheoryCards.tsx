import React, { useMemo } from 'react';
import GrammarBlockCard from './GrammarBlockCard';
import { ParsedGrammarNotes } from './parseGrammarNotes';
import { buildGrammarBlocks } from './grammarBlocks';
import { useTranslation } from '../../../i18n/useTranslation';

interface GrammarTheoryCardsProps {
  parsed: ParsedGrammarNotes;
}

// Sprint 06A — the Grammar theory stage.
//
// Replaces GrammarLessonContent's uniform stack of full-width rectangles with
// typed learning cards in a responsive grid: 2 columns from `lg`, 1 below.
//
// Cards appear in AUTHOR ORDER; only the lesson summary is pulled to the end.
// A kind the author did not write produces no card and occupies no cell, so
// the grid simply reflows — a Foundation lesson (concept, rule, formula,
// examples, tips) shows no trace that TOEIC blocks exist.
const GrammarTheoryCards: React.FC<GrammarTheoryCardsProps> = ({ parsed }) => {
  const { t } = useTranslation();
  const theory = useMemo(() => buildGrammarBlocks(parsed), [parsed]);

  // Notes with no `## headings` at all — one honest plain card, the behaviour
  // GrammarLessonContent had for this case.
  if (theory.fallbackText) {
    return (
      <div className="bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 rounded-2xl shadow-sm dark:shadow-xl p-6">
        <h3 className="text-sm font-black text-slate-900 dark:text-white mb-2">{t.lesson.notesFallbackTitle}</h3>
        <p className="text-[14px] font-medium text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
          {theory.fallbackText}
        </p>
      </div>
    );
  }

  if (theory.blocks.length === 0 && !theory.summary) return null;

  return (
    <div className="space-y-5">
      {theory.blocks.length > 0 && (
        <ul
          aria-label={t.lesson.theoryCardsLabel}
          className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start"
        >
          {theory.blocks.map((block) => (
            <GrammarBlockCard key={`${block.kind}-${block.index}`} block={block} />
          ))}
        </ul>
      )}

      {/* Always last, outside the grid — it closes the lesson. */}
      {theory.summary && (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <GrammarBlockCard block={theory.summary} />
        </ul>
      )}
    </div>
  );
};

export default GrammarTheoryCards;
