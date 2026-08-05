import React, { useState } from 'react';
import { ListOrdered, Sparkles } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';
import type { ListeningSegment } from '../../../services/listeningService';

// Sprint 11 Phase 2 — the sentence list, shared by every practice mode.
// Successor to SubtitlesSidebar, which was typed against the client seed.
//
// THE MASKING RULE IS A CONTENT-SECURITY GUARANTEE, NOT STYLING. In Dictation
// the sentence IS the answer, so an unsolved row must never render its text —
// not visually, and not to assistive technology. A Sprint 03F fix had to
// remove `isActive` from the reveal condition after the merely-selected row
// started leaking its own answer. The dots are `aria-hidden` for the same
// reason: a screen-reader user must not be read the answer that a sighted user
// cannot see.
//
// `maskUnrevealed` is a PROP because the rule is per-mode, not universal.
// Dictation masks; Shadowing shows the reference sentence, because reading it
// aloud is the exercise. Making it a prop keeps one list component honest for
// both instead of forking it.

interface SegmentListPanelProps {
  segments: ListeningSegment[];
  currentIndex: number;
  /** Sentences the student has already completed this session. */
  revealedSegmentIds: Set<string>;
  /** Completed only after revealing a word — shown distinctly, never by colour alone. */
  assistedSegmentIds: Set<string>;
  maskUnrevealed: boolean;
  hideTranslation: boolean;
  /** REAL provider playback state for the current row's badge. */
  isPlaying: boolean;
  onSelectSegment: (index: number) => void;
}

const SegmentListPanel: React.FC<SegmentListPanelProps> = ({
  segments,
  currentIndex,
  revealedSegmentIds,
  assistedSegmentIds,
  maskUnrevealed,
  hideTranslation,
  isPlaying,
  onSelectSegment,
}) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'subtitles' | 'tips'>('subtitles');

  const completedCount = revealedSegmentIds.size;
  const overallPercent =
    segments.length > 0 ? Math.round((completedCount / segments.length) * 100) : 0;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-0.5">
          <button
            type="button"
            onClick={() => setTab('subtitles')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              tab === 'subtitles'
                ? 'bg-blue-500 text-white shadow'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <ListOrdered size={14} aria-hidden="true" />
            <span>{t.practice.listeningSubtitlesTab}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('tips')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              tab === 'tips'
                ? 'bg-blue-500 text-white shadow'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles size={14} className="text-amber-400" aria-hidden="true" />
            <span>{t.practice.listeningTipsTab}</span>
          </button>
        </div>
        <span className="text-xs font-mono font-bold text-blue-500 dark:text-blue-400">
          {segments.length === 0 ? 0 : currentIndex + 1}/{segments.length}
        </span>
      </div>

      {/* Session-only counts, stated as such by the mode panel. The ARIA
          values are the same real numbers shown visually. */}
      <div className="space-y-1.5 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-slate-400 dark:text-slate-500">{t.practice.progressLabel}</span>
          <span className="text-emerald-600 dark:text-emerald-400">{overallPercent}%</span>
        </div>
        <div
          role="progressbar"
          aria-label={t.practice.progressLabel}
          aria-valuemin={0}
          aria-valuemax={segments.length}
          aria-valuenow={completedCount}
          className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"
        >
          <div
            style={{ width: `${overallPercent}%` }}
            className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-300"
          />
        </div>
      </div>

      {tab === 'subtitles' ? (
        <ul className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
          {segments.map((segment, index) => {
            const isActive = index === currentIndex;
            const isRevealed = revealedSegmentIds.has(segment.id);
            const isAssisted = assistedSegmentIds.has(segment.id);
            const canShowText = !maskUnrevealed || isRevealed;
            const isRowPlaying = isActive && isPlaying;
            const isLearning = isActive && !isRevealed && !isRowPlaying;

            return (
              <li key={segment.id}>
                <button
                  type="button"
                  onClick={() => onSelectSegment(index)}
                  aria-current={isActive ? 'true' : undefined}
                  aria-label={`${t.practice.questionLabel} ${index + 1}`}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500'
                      : isRevealed
                        ? isAssisted
                          ? 'bg-amber-50/60 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/30'
                          : 'bg-emerald-50/60 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/30'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center font-mono ${
                        isRevealed
                          ? isAssisted
                            ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                            : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
                      }`}
                    >
                      {index + 1}
                    </span>
                    {isRevealed && isAssisted && (
                      <span className="text-[9px] font-bold uppercase text-amber-600 dark:text-amber-400">
                        {t.practice.assistedLabel}
                      </span>
                    )}
                    {isRowPlaying && (
                      <span className="text-[9px] font-bold uppercase text-blue-600 dark:text-blue-400">
                        {t.practice.listeningNowPlayingBadge}
                      </span>
                    )}
                    {isLearning && (
                      <span className="text-[9px] font-bold uppercase text-blue-600 dark:text-blue-400">
                        {t.practice.listeningLearningBadge}
                      </span>
                    )}
                  </div>
                  {canShowText ? (
                    <div className="space-y-0.5">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                        {segment.text}
                      </p>
                      {!hideTranslation && segment.translationVi && (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                          {segment.translationVi}
                        </p>
                      )}
                    </div>
                  ) : (
                    // Word-length dots: enough to tell a three-word sentence
                    // from a twelve-word one, with no content leaked. Hidden
                    // from assistive tech — see this file's header.
                    <p
                      aria-hidden="true"
                      className="text-xs text-slate-400 dark:text-slate-600 font-mono tracking-widest select-none"
                    >
                      {segment.text
                        .split(' ')
                        .map((word) => '•'.repeat(Math.max(2, word.length)))
                        .join(' ')}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
          <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl space-y-1.5">
            <h4 className="font-extrabold text-blue-600 dark:text-blue-400 uppercase flex items-center gap-1.5">
              <Sparkles size={14} aria-hidden="true" />
              {t.practice.listeningTipsTitle}
            </h4>
            <ul className="space-y-1.5 list-disc pl-4 leading-relaxed">
              <li>{t.practice.listeningTip1}</li>
              <li>{t.practice.listeningTip2}</li>
              <li>{t.practice.listeningTip3}</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default SegmentListPanel;
