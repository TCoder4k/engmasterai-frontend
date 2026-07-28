import React, { useState } from 'react';
import { ArrowRight, Check, Gauge, ListTree, Lock, Target } from 'lucide-react';
import { Lesson } from '../../types';
import { ParsedGrammarNotes } from './grammar/parseGrammarNotes';
import { useTranslation } from '../../i18n/useTranslation';

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5];

interface VideoStagePanelProps {
  lesson: Lesson;
  parsed: ParsedGrammarNotes;
  player: any | null;
  onGoToTheory: () => void;
}

// The right-hand column of the video stage. The design reference puts a
// synced transcript here; `Lesson` has no transcript field of any kind
// (notes is a single text blob), so the slot carries something real
// instead — the lesson's own outline, parsed from its `## headings`, with
// each heading jumping into the theory stage. Falls back to the real
// learning objectives, and collapses entirely when the lesson has neither.
export const VideoStageSidePanel: React.FC<VideoStagePanelProps> = ({
  lesson,
  parsed,
  player,
  onGoToTheory,
}) => {
  const { t } = useTranslation();
  const [rate, setRate] = useState(1);

  const hasOutline = parsed.sections.some((section) => section.heading);
  const hasObjectives = lesson.learningObjectives.length > 0;

  const applyRate = (next: number) => {
    setRate(next);
    // Driven off the live YT instance — no custom playback implementation.
    player?.setPlaybackRate?.(next);
  };

  return (
    <div className="bg-white dark:bg-ink-900 border border-slate-100 dark:border-ink-700 rounded-2xl overflow-hidden shadow-sm dark:shadow-xl flex flex-col">
      <div className="p-4 border-b border-slate-100 dark:border-ink-700 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
          <ListTree size={15} className="text-indigo-500 dark:text-indigo-400" aria-hidden="true" />
          {hasOutline ? t.lesson.outlineTitle : t.lesson.objectivesTitle}
        </h3>
      </div>

      {/* Playback speed — only meaningful once the player actually exists. */}
      {player && (
        <div className="px-4 py-3 border-b border-slate-100 dark:border-ink-700">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-2">
            <Gauge size={12} aria-hidden="true" />
            {t.lesson.playbackSpeed}
          </p>
          <div className="flex items-center gap-1.5" role="group" aria-label={t.lesson.playbackSpeed}>
            {PLAYBACK_RATES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => applyRate(value)}
                aria-pressed={rate === value}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                  rate === value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-50 text-slate-500 dark:bg-ink-950 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {value}x
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 p-4 space-y-2 max-h-[380px] overflow-y-auto">
        {hasOutline &&
          parsed.sections
            .filter((section) => section.heading)
            .map((section) => (
              <button
                key={section.heading}
                type="button"
                onClick={onGoToTheory}
                className="w-full text-left p-3 rounded-xl bg-slate-50 dark:bg-ink-950 border border-slate-100 dark:border-ink-700 hover:border-indigo-300 dark:hover:border-indigo-500/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <span className="block text-[13px] font-bold text-slate-800 dark:text-slate-100">
                  {section.heading}
                </span>
              </button>
            ))}

        {!hasOutline && hasObjectives && (
          <ul className="space-y-2">
            {lesson.learningObjectives.map((objective, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-[13px] font-medium text-slate-600 dark:text-slate-300"
              >
                <Target size={13} className="text-indigo-400 mt-1 flex-shrink-0" aria-hidden="true" />
                <span>{objective}</span>
              </li>
            ))}
          </ul>
        )}

        {!hasOutline && !hasObjectives && (
          <p className="text-[13px] font-medium text-slate-400 dark:text-slate-500">
            {t.lesson.notesFallbackTitle}
          </p>
        )}
      </div>

      <div className="p-4 border-t border-slate-100 dark:border-ink-700">
        <button
          type="button"
          onClick={onGoToTheory}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-extrabold shadow-lg shadow-emerald-500/20 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <Check size={14} aria-hidden="true" />
          <span>{t.lesson.videoWatchedCta}</span>
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

interface TheoryCompletionBarProps {
  isComplete: boolean;
  onMarkRead: () => void;
  // Sprint 06B.5 — whether this lesson actually has a published quiz, and
  // how to get there. Absent means it genuinely has none.
  hasQuiz?: boolean;
  onGoToQuiz?: () => void;
}

// Footer of the theory stage. Marking it read is what makes the theory stage
// complete — and, together with the video and the quiz, what makes the LESSON
// complete.
//
// Sprint 06B.5 bug fix: this bar used to ALWAYS render a locked "Next: Quiz
// Part 5 — coming soon" chip, written when LessonTask/Question were still
// schema-only. Sprint 06B shipped the quiz for real, so on a quiz-bearing
// lesson that chip was telling students a live feature was unavailable. It
// now reflects the lesson's actual state: a real link when a published quiz
// exists, the honest locked chip only when one doesn't.
export const TheoryCompletionBar: React.FC<TheoryCompletionBarProps> = ({
  isComplete,
  onMarkRead,
  hasQuiz = false,
  onGoToQuiz,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      {isComplete ? (
        <div className="flex items-center gap-2 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-sm font-bold">
          <Check size={16} aria-hidden="true" />
          <span>{t.lesson.theoryRead}</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={onMarkRead}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-extrabold shadow-lg shadow-indigo-500/20 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <Check size={15} aria-hidden="true" />
          <span>{t.lesson.theoryReadCta}</span>
        </button>
      )}

      {hasQuiz && onGoToQuiz ? (
        <button
          type="button"
          onClick={onGoToQuiz}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white dark:bg-ink-900 border-2 border-indigo-200 dark:border-indigo-500/40 text-indigo-600 dark:text-indigo-300 text-xs font-bold hover:border-indigo-400 dark:hover:border-indigo-400 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <span>{t.lesson.nextStageQuiz}</span>
          <ArrowRight size={13} aria-hidden="true" />
        </button>
      ) : (
        <div
          aria-disabled="true"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-100 dark:bg-ink-950 border border-slate-200 dark:border-ink-700 text-slate-400 dark:text-slate-500 text-xs font-bold cursor-not-allowed select-none"
        >
          <Lock size={13} aria-hidden="true" />
          <span>{t.lesson.nextStageLocked}</span>
        </div>
      )}
    </div>
  );
};
