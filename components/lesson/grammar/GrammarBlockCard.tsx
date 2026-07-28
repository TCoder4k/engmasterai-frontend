import React, { useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ClipboardCheck,
  Flame,
  Lightbulb,
  Quote,
  Scale,
  Sigma,
  Sparkles,
  StickyNote,
  Tag,
  Target,
  X,
} from 'lucide-react';
import {
  GrammarBlock,
  GrammarBlockKind,
  isLongBody,
  splitExamples,
  splitFormula,
  splitMistakes,
  splitSignalWords,
} from './grammarBlocks';
import { useTranslation } from '../../../i18n/useTranslation';
import { DURATION, EASE } from '../../shared/motion';

// Sprint 06A — one theory block, one card.
//
// The card's colour, icon, width and collapse behaviour come from its derived
// kind, so a formula LOOKS like a formula and a mistake LOOKS like a warning
// rather than every section rendering as the same white rectangle.
//
// The rule that governs this file: a card exists only because an author wrote
// its block. There is no placeholder, no empty container and no grid cell held
// open for a block that is absent — a Foundation lesson with five blocks must
// show no trace that TOEIC blocks are a thing.

interface BlockStyle {
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;
  /** Grid span. Core, high-emphasis blocks run the full width. */
  span: 'full' | 'half';
  /** Card surface + border. */
  card: string;
  /** Badge pill. */
  badge: string;
  /** Icon tint. */
  accent: string;
  /**
   * Concept, rule, formula and examples are ALWAYS open. Examples especially:
   * "I go to school." is the point of a grammar card, not something a student
   * should have to click for.
   */
  collapsible: boolean;
}

const BLOCK_STYLES: Record<GrammarBlockKind, BlockStyle> = {
  concept: {
    icon: Lightbulb,
    span: 'full',
    card: 'bg-white dark:bg-ink-900 border-indigo-100 dark:border-indigo-500/25',
    badge: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300',
    accent: 'text-indigo-500 dark:text-indigo-400',
    collapsible: false,
  },
  rule: {
    icon: Scale,
    span: 'full',
    card: 'bg-white dark:bg-ink-900 border-slate-200 dark:border-ink-700',
    badge: 'bg-indigo-600 text-white dark:bg-indigo-500',
    accent: 'text-indigo-500 dark:text-indigo-400',
    collapsible: false,
  },
  formula: {
    icon: Sigma,
    span: 'full',
    card: 'bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-500/10 dark:to-violet-500/5 border-purple-200 dark:border-purple-500/30 ring-1 ring-purple-100 dark:ring-purple-500/20',
    badge: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-200',
    accent: 'text-purple-500 dark:text-purple-300',
    collapsible: false,
  },
  examples: {
    icon: Quote,
    span: 'full',
    card: 'bg-white dark:bg-ink-900 border-slate-200 dark:border-ink-700',
    badge: 'bg-slate-100 text-slate-600 dark:bg-ink-800 dark:text-slate-300',
    accent: 'text-slate-400 dark:text-slate-500',
    collapsible: false,
  },
  tips: {
    icon: Sparkles,
    span: 'half',
    card: 'bg-cyan-50/60 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/30',
    badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-200',
    accent: 'text-cyan-500 dark:text-cyan-300',
    collapsible: true,
  },
  mistakes: {
    icon: AlertTriangle,
    span: 'half',
    card: 'bg-amber-50/70 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
    accent: 'text-amber-500 dark:text-amber-300',
    collapsible: true,
  },
  signalWords: {
    icon: Tag,
    span: 'half',
    card: 'bg-white dark:bg-ink-900 border-blue-200 dark:border-blue-500/30',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200',
    accent: 'text-blue-500 dark:text-blue-300',
    collapsible: false,
  },
  toeicFocus: {
    icon: Target,
    span: 'half',
    card: 'bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
    accent: 'text-emerald-500 dark:text-emerald-300',
    collapsible: true,
  },
  // Deliberately hotter than the amber `mistakes` card: a mistake is something
  // a student makes, a trap is something the exam does to them.
  examTrap: {
    icon: Flame,
    span: 'half',
    card: 'bg-orange-50/70 dark:bg-orange-500/10 border-orange-300 dark:border-orange-500/40',
    badge: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200',
    accent: 'text-orange-500 dark:text-orange-300',
    collapsible: true,
  },
  summary: {
    icon: ClipboardCheck,
    span: 'full',
    card: 'bg-slate-50 dark:bg-ink-950 border-slate-200 dark:border-ink-700',
    badge: 'bg-slate-200 text-slate-700 dark:bg-ink-800 dark:text-slate-200',
    accent: 'text-slate-400 dark:text-slate-500',
    collapsible: false,
  },
  note: {
    icon: StickyNote,
    span: 'full',
    card: 'bg-white dark:bg-ink-900 border-slate-200 dark:border-ink-700',
    badge: 'bg-slate-100 text-slate-600 dark:bg-ink-800 dark:text-slate-300',
    accent: 'text-slate-400 dark:text-slate-500',
    collapsible: true,
  },
};

const PROSE = 'text-[14px] font-medium text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap';

interface GrammarBlockCardProps {
  block: GrammarBlock;
}

const GrammarBlockCard: React.FC<GrammarBlockCardProps> = ({ block }) => {
  const { t } = useTranslation();
  const style = BLOCK_STYLES[block.kind];
  const bodyId = useId();

  const labels: Record<GrammarBlockKind, string> = {
    concept: t.lesson.blockConcept,
    rule: t.lesson.blockRule,
    formula: t.lesson.blockFormula,
    examples: t.lesson.blockExamples,
    mistakes: t.lesson.blockMistakes,
    tips: t.lesson.blockTips,
    signalWords: t.lesson.blockSignalWords,
    toeicFocus: t.lesson.blockToeicFocus,
    examTrap: t.lesson.blockExamTrap,
    summary: t.lesson.blockSummary,
    note: t.lesson.blockNote,
  };

  // Collapsible blocks start closed only when the body is actually long —
  // collapsing a two-line tip adds friction instead of removing it.
  const canCollapse = style.collapsible && isLongBody(block.body);
  const [isOpen, setIsOpen] = useState(!canCollapse);

  const badgeText =
    block.kind === 'rule' && block.ruleNumber !== null
      ? `${t.lesson.blockRule} #${block.ruleNumber}`
      : labels[block.kind];

  // The author's own heading is the title, except on a rule card where the
  // "Rule 1 — " prefix already lives in the badge. A heading that just repeats
  // the badge ("## Examples" under an EXAMPLES badge) is dropped rather than
  // printed twice; "## Concept Summary" under CONCEPT still earns its line.
  const heading = block.heading.trim();
  const title =
    block.kind === 'rule'
      ? block.ruleTitle
      : heading && heading.toLowerCase() !== labels[block.kind].toLowerCase()
        ? heading
        : null;

  const Icon = style.icon;

  return (
    <li
      id={`section-${block.index}`}
      // Sprint 06B.5 — hover lift + shadow bloom, matching the landing
      // page's card language (Features.tsx). Theory was completely static
      // on hover before; the formula card, already the only style with both
      // a gradient and a ring, gets a slightly stronger lift so its
      // existing visual primacy is reinforced by motion rather than by
      // piling on more colour.
      className={`${style.span === 'full' ? 'lg:col-span-2' : ''} scroll-mt-24 list-none rounded-2xl border p-5 shadow-sm dark:shadow-xl transition-all duration-300 hover:shadow-lg ${
        block.kind === 'formula' ? 'hover:-translate-y-1' : 'hover:-translate-y-0.5'
      } ${style.card}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={16} className={`flex-shrink-0 ${style.accent} transition-transform duration-300 group-hover:scale-110`} aria-hidden={true} />
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide transition-colors duration-300 ${style.badge}`}
          >
            {badgeText}
          </span>
        </div>

        {canCollapse && (
          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            aria-expanded={isOpen}
            aria-controls={bodyId}
            className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-lg px-1.5 py-1"
          >
            {isOpen ? t.lesson.blockCollapse : t.lesson.blockExpand}
            <ChevronDown size={13} className={isOpen ? 'rotate-180 transition-transform' : 'transition-transform'} aria-hidden={true} />
          </button>
        )}
      </div>

      {title && (
        <h3 className="text-sm font-black text-slate-900 dark:text-white mb-2 break-words">{title}</h3>
      )}

      {/*
        Sprint 06B.5 — the body used the `hidden` attribute, so expanding
        was an instant jump. Animating the height makes the card grow into
        its content. `hidden` is still applied while collapsed so the
        content stays out of the accessibility tree and out of Find-in-page
        exactly as before.
      */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={bodyId}
            key="body"
            // Height only, deliberately no opacity: fading a disclosure
            // adds nothing, and an opacity-0 start would leave the content
            // genuinely invisible for anyone whose animations are disabled
            // or interrupted. Height snapping open is always safe.
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: DURATION.base, ease: EASE }}
            className="overflow-hidden"
          >
            <BlockBody block={block} />
          </motion.div>
        )}
      </AnimatePresence>
      {!isOpen && <div id={bodyId} hidden />}
    </li>
  );
};

// Each shaper returns null when the body does not have its shape, and the card
// falls back to plain text. Nothing here ever adds content that is not in the
// author's own text.
const BlockBody: React.FC<{ block: GrammarBlock }> = ({ block }) => {
  const { t } = useTranslation();

  if (block.kind === 'formula') {
    const formula = splitFormula(block.body);
    if (!formula) return <p className={PROSE}>{block.body}</p>;
    return (
      <div className="space-y-2">
        {formula.map((line, index) => (
          <div key={index} className="rounded-xl bg-white/70 dark:bg-ink-950/60 border border-purple-100 dark:border-purple-500/20 px-4 py-3">
            {line.label && (
              <p className="text-[10px] font-black uppercase tracking-wide text-purple-500 dark:text-purple-300 mb-1">
                {line.label}
              </p>
            )}
            <p className="font-mono text-[15px] sm:text-base font-bold text-slate-900 dark:text-white break-words">
              {line.value}
            </p>
          </div>
        ))}
      </div>
    );
  }

  if (block.kind === 'examples') {
    const examples = splitExamples(block.body);
    if (!examples) return <p className={PROSE}>{block.body}</p>;
    return (
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {examples.map((example, index) => (
          <li
            key={index}
            className="rounded-xl bg-slate-50 dark:bg-ink-950 border border-slate-100 dark:border-ink-700 px-4 py-3"
          >
            <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">{example.en}</p>
            {/* Rendered only when the author wrote a translation. */}
            {example.vi && (
              <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">{example.vi}</p>
            )}
          </li>
        ))}
      </ul>
    );
  }

  if (block.kind === 'mistakes') {
    const mistakes = splitMistakes(block.body);
    if (!mistakes) return <p className={PROSE}>{block.body}</p>;
    return (
      <ul className="space-y-2.5">
        {mistakes.map((mistake, index) => (
          <li key={index} className="space-y-1">
            {mistake.wrong && (
              <p className="flex items-start gap-2 text-[14px] font-semibold text-rose-700 dark:text-rose-300">
                <X size={14} className="mt-1 flex-shrink-0" aria-hidden={true} />
                <span>
                  <span className="sr-only">{t.lesson.mistakeWrong}: </span>
                  {mistake.wrong}
                </span>
              </p>
            )}
            {/* Absent whenever the author wrote no correction — never generated. */}
            {mistake.right && (
              <p className="flex items-start gap-2 text-[14px] font-semibold text-emerald-700 dark:text-emerald-300">
                <Check size={14} className="mt-1 flex-shrink-0" aria-hidden={true} />
                <span>
                  <span className="sr-only">{t.lesson.mistakeRight}: </span>
                  {mistake.right}
                </span>
              </p>
            )}
          </li>
        ))}
      </ul>
    );
  }

  if (block.kind === 'signalWords') {
    const words = splitSignalWords(block.body);
    if (!words) return <p className={PROSE}>{block.body}</p>;
    return (
      <ul className="flex flex-wrap gap-2">
        {words.map((word, index) => (
          <li
            key={index}
            className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200"
          >
            {word}
          </li>
        ))}
      </ul>
    );
  }

  return <p className={PROSE}>{block.body}</p>;
};

export default GrammarBlockCard;
