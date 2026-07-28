import React, { useState } from 'react';
import { ListOrdered, Sparkles } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';
import { DictationLesson } from './listeningContent';

interface SubtitlesSidebarProps {
  lesson: DictationLesson;
  currentSegmentIndex: number;
  solvedSegmentIds: Set<number>;
  // Segments solved with reveal help — shown distinctly (amber + text
  // label, never color alone) since a revealed word isn't independently
  // earned (Sprint 03E).
  assistedSegmentIds: Set<number>;
  hideTranslation: boolean;
  // Real playback state (Sprint 03F): the current segment's own play/pause
  // state, plus which (if any) already-solved row is being replayed — both
  // drive the LISTENING vs LEARNING badge, never fabricated.
  isPlaying: boolean;
  replayingSegmentIndex: number | null;
  onSelectSegment: (index: number) => void;
  onReplaySegment: (index: number) => void;
}

const SubtitlesSidebar: React.FC<SubtitlesSidebarProps> = ({
  lesson,
  currentSegmentIndex,
  solvedSegmentIds,
  assistedSegmentIds,
  hideTranslation,
  isPlaying,
  replayingSegmentIndex,
  onSelectSegment,
  onReplaySegment,
}) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'subtitles' | 'tips'>('subtitles');
  const overallPercent = Math.round((solvedSegmentIds.size / lesson.segments.length) * 100);

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
          {currentSegmentIndex + 1}/{lesson.segments.length}
        </span>
      </div>

      {/* Real session-only progress: solved-this-session / total. ARIA
          progressbar values are the real counts. */}
      <div className="space-y-1.5 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-slate-400 dark:text-slate-500">{t.practice.progressLabel}</span>
          <span className="text-emerald-600 dark:text-emerald-400">{overallPercent}%</span>
        </div>
        <div
          role="progressbar"
          aria-label={t.practice.progressLabel}
          aria-valuemin={0}
          aria-valuemax={lesson.segments.length}
          aria-valuenow={solvedSegmentIds.size}
          className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"
        >
          <div
            style={{ width: `${overallPercent}%` }}
            className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-300"
          />
        </div>
      </div>

      {tab === 'subtitles' ? (
        <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
          {lesson.segments.map((seg, idx) => {
            const isActive = idx === currentSegmentIndex;
            const isSolved = solvedSegmentIds.has(seg.id);
            const isAssisted = assistedSegmentIds.has(seg.id);
            // A segment only ever reveals its real text/translation once
            // solved — being merely active/current never leaks content
            // (Sprint 03F fix: this used to also include `isActive`).
            const canReveal = isSolved;
            const isRowPlaying = isActive ? isPlaying : replayingSegmentIndex === idx;
            const isLearning = isActive && !isSolved && !isRowPlaying;
            return (
              <button
                key={seg.id}
                type="button"
                onClick={() => (isSolved ? onReplaySegment(idx) : onSelectSegment(idx))}
                aria-label={isSolved ? `${t.practice.listeningReplay} ${t.practice.questionLabel} ${idx + 1}` : undefined}
                className={`w-full text-left p-3.5 rounded-2xl border transition-colors ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500'
                    : isSolved
                      ? isAssisted
                        ? 'bg-amber-50/60 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/30'
                        : 'bg-emerald-50/60 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/30'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center font-mono ${
                      isSolved
                        ? isAssisted
                          ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
                    }`}
                  >
                    #{seg.id}
                  </span>
                  {isSolved && isAssisted && (
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
                {canReveal ? (
                  <div className="space-y-0.5">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">{seg.textEn}</p>
                    {!hideTranslation && (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">{seg.textVi}</p>
                    )}
                  </div>
                ) : (
                  // Decorative masking dots, derived from each word's real
                  // length so a learner can tell "3 words / 6 words" apart
                  // without any content leaking — hidden from assistive
                  // tech so the unsolved text is neither visible nor
                  // announced.
                  <p
                    aria-hidden="true"
                    className="text-xs text-slate-400 dark:text-slate-600 font-mono tracking-widest select-none"
                  >
                    {seg.textEn
                      .split(' ')
                      .map((w) => '•'.repeat(Math.max(2, w.length)))
                      .join(' ')}
                  </p>
                )}
              </button>
            );
          })}
        </div>
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

export default SubtitlesSidebar;
