import React from 'react';
import { CheckCircle2, AlertCircle, BarChart3 } from 'lucide-react';
import { useTranslation } from '../../../../i18n/useTranslation';
import TranscriptComparison from './TranscriptComparison';
import ShadowingScoreRing from './ShadowingScoreRing';
import type { SubmitShadowingAttemptResult } from '../../../../services/listeningService';

// Sprint 11 Phase 4B — the verdict on one spoken attempt.
//
// EVERY NUMBER HERE CAME FROM THE SERVER. Nothing is computed in this file,
// including the pass/fail decision — `result.passed` is read, never derived
// from `accuracyPercent >= threshold`, because re-deriving it in the browser
// would create a second place for the rule to live and a second answer to
// disagree with.
//
// WHAT IS DELIBERATELY ABSENT: any pronunciation score. The accuracy below is
// a WORD-MATCH figure computed from a transcript — it says which words were
// recognised, and it says nothing whatsoever about how they were pronounced.
// Labelling it "pronunciation" would be a fabricated assessment, and the copy
// says what it actually measures.
//
// Phase 4C reordered this into the shape a student reads it in — how many words
// landed, then what they actually said, then which words went wrong — and moved
// the recording's own player inside "You said", because the transcript and the
// audio it came from are one claim and belong side by side. `playback` and
// `aiFeedback` are SLOTS rather than props of their own: this component owns the
// verdict, and neither the object URL nor the feedback request is its business.

interface ShadowingResultPanelProps {
  result: SubmitShadowingAttemptResult;
  /** The recording this verdict was produced from. Rendered under the transcript. */
  playback?: React.ReactNode;
  /** Sprint 11 Phase 4C — optional AI coaching, which is not part of the verdict. */
  aiFeedback?: React.ReactNode;
}

const ShadowingResultPanel: React.FC<ShadowingResultPanelProps> = ({
  result,
  playback,
  aiFeedback,
}) => {
  const { t } = useTranslation();

  const tone = result.passed
    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/40'
    : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/40';

  return (
    <div
      className={`p-4 rounded-2xl border space-y-4 ${tone}`}
      data-testid="shadowing-result"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          role="status"
          aria-live="polite"
          className={`inline-flex items-center gap-1.5 text-xs font-black ${
            result.passed
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-amber-700 dark:text-amber-300'
          }`}
        >
          {result.passed ? (
            <CheckCircle2 size={15} aria-hidden="true" />
          ) : (
            <AlertCircle size={15} aria-hidden="true" />
          )}
          <span>
            {result.passed
              ? t.practice.shadowingResultPassed
              : t.practice.shadowingResultNotYet}
          </span>
        </span>

        {/* The bar the student was measured against, stated rather than
            implied. A score with no visible threshold is a number they cannot
            interpret. */}
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          {t.practice.shadowingPassThreshold}: {result.passThresholdPercent}%
        </span>
      </div>

      <p className="flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
        <BarChart3 size={15} aria-hidden="true" className="text-slate-500 dark:text-slate-500" />
        <span className="tabular-nums">
          {result.wordsCorrect}/{result.wordsTotal} {t.practice.shadowingWordsMatched}
        </span>
      </p>

      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 space-y-2">
        <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-500">
          {t.practice.shadowingYouSaidTitle}
        </p>
        {/* The RAW transcript, not the normalized one. Showing "dont" for
            "don't" would present our own processing as the student's speech. */}
        <p className="text-sm sm:text-base font-semibold italic text-slate-700 dark:text-slate-200 min-h-[1.25rem]">
          {result.transcript ? (
            // The quote marks are their own decorative elements so the
            // transcript stays one exact, addressable string — punctuation the
            // app added must not become part of what the student said.
            <>
              <span aria-hidden="true">“</span>
              <span>{result.transcript}</span>
              <span aria-hidden="true">”</span>
            </>
          ) : (
            <span className="not-italic font-medium text-slate-500 dark:text-slate-500">
              {t.practice.shadowingTranscriptEmpty}
            </span>
          )}
        </p>
        {playback}
      </div>

      {/* THE ACCURACY FIGURE RENDERS EXACTLY ONCE, IN THIS RING. It used to be
          a pill in `ShadowingHeaderBar`; Phase 4C's dark redesign moved it
          here, beside the word-by-word comparison it explains, and it is not
          also repeated in the header — one number in two places is one number
          that can be read as two. */}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <TranscriptComparison tokens={result.alignment} />
        </div>
        <ShadowingScoreRing
          percent={result.accuracyPercent}
          passed={result.passed}
          label={t.practice.listeningAccuracyLabel}
        />
      </div>

      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-500">
        {t.practice.shadowingAccuracyDisclaimer}
      </p>

      {aiFeedback}
    </div>
  );
};

export default ShadowingResultPanel;
