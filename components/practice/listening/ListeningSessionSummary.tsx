import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Layers, Target, Clock, Type, Headphones, ListOrdered } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';
import { formatAudioTime } from '../useAudioPlayback';
import { DictationLesson, ListeningLessonSummary, getLessonSummaries } from './listeningContent';
import { getListeningSession } from './listeningSessionStore';

interface ListeningSessionSummaryProps {
  lesson: DictationLesson;
  totalSegments: number;
  // Real, derived from assistedSegmentIds.size at completion — never
  // fabricated. A lesson can only finish once every segment is solved (the
  // workspace's Next stays disabled until solved), so assistedCount is
  // always <= totalSegments. Still needed here even though Accuracy is now
  // word-based: it drives "has mistakes to replay" and Replay Mistakes.
  assistedCount: number;
  // Real, this-attempt word counts (Sprint 03G) — wordsCorrect excludes
  // revealed words, so a lesson where every segment reached "solved" can
  // still show less than 100% here if some words needed help.
  wordsCorrect: number;
  wordsTotal: number;
  elapsedSeconds: number;
  onReplayMistakes: () => void;
  onReplayLesson: () => void;
  onBackToLessons: () => void;
}

// Same-topic-first, then not-yet-finished (checked honestly against the
// real, session-scoped listeningSessionStore — never persisted, same
// caveat as the catalog's own "Continue Learning" section), explicitly
// excluding the current lesson, deduped, capped at 3. No fake
// personalization/popularity — just real catalog + real session data.
const getSuggestedLessons = (current: DictationLesson): ListeningLessonSummary[] => {
  const others = getLessonSummaries().filter((l) => l.id !== current.id);
  const sameTopic = others.filter((l) => l.topic === current.topic);
  const notFinished = others.filter((l) => {
    const session = getListeningSession(l.id);
    return !session || session.solvedSegmentIds.length < session.totalSegments;
  });
  const merged: ListeningLessonSummary[] = [];
  for (const l of [...sameTopic, ...notFinished, ...others]) {
    if (merged.length >= 3) break;
    if (!merged.some((m) => m.id === l.id)) merged.push(l);
  }
  return merged;
};

// Listening's own completion card — deliberately not a reuse of
// components/practice/SessionSummary.tsx (Vocab's Flashcard/Dictation/Games
// completion is score/percent + "Try again"/"Back to decks", a genuinely
// different shape from what a finished listening lesson should offer).
// Forcing both through one shared component would mean branching inside it
// per caller — this purpose-built component avoids that entirely.
const ListeningSessionSummary: React.FC<ListeningSessionSummaryProps> = ({
  lesson,
  totalSegments,
  assistedCount,
  wordsCorrect,
  wordsTotal,
  elapsedSeconds,
  onReplayMistakes,
  onReplayLesson,
  onBackToLessons,
}) => {
  const { t } = useTranslation();
  // Word-based, not segment-based: a segment reaching "solved" doesn't mean
  // every word in it was typed correctly (some may have been revealed), so
  // a pass/fail-per-segment accuracy would hide real mistakes.
  const accuracyPercent = wordsTotal > 0 ? Math.round((wordsCorrect / wordsTotal) * 100) : 0;
  const hasMistakes = assistedCount > 0;
  const suggested = getSuggestedLessons(lesson);
  const nextLesson = suggested[0];

  return (
    <div className="practice-fade-in bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm p-8 text-center space-y-6">
      <div>
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-500/10 border-2 border-emerald-400 dark:border-emerald-500 flex items-center justify-center practice-summary-glow">
          <CheckCircle2 size={30} className="text-emerald-500" aria-hidden="true" />
        </div>
        <p className="text-lg font-black text-slate-900 dark:text-slate-100 mt-4">{t.practice.listeningComplete}</p>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-1">{lesson.title}</p>
        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 dark:text-slate-500 mt-1">
          <span>{lesson.topic}</span>
          <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md uppercase text-[10px] font-black">
            {lesson.level}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-3 flex flex-col items-center gap-1">
          <Layers size={16} className="text-blue-500 dark:text-blue-400" aria-hidden="true" />
          <span className="text-lg font-black text-slate-900 dark:text-slate-100">
            {totalSegments}/{totalSegments}
          </span>
          <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">
            {t.practice.listeningSegmentsStat}
          </span>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-3 flex flex-col items-center gap-1">
          <Type size={16} className="text-blue-500 dark:text-blue-400" aria-hidden="true" />
          <span className="text-lg font-black text-slate-900 dark:text-slate-100">
            {wordsCorrect}/{wordsTotal}
          </span>
          <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">
            {t.practice.listeningWordsStat}
          </span>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-3 flex flex-col items-center gap-1">
          <Target size={16} className="text-emerald-500" aria-hidden="true" />
          <span className="text-lg font-black text-slate-900 dark:text-slate-100">{accuracyPercent}%</span>
          <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">
            {t.practice.listeningAccuracyLabel}
          </span>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-3 flex flex-col items-center gap-1">
          <Clock size={16} className="text-blue-500 dark:text-blue-400" aria-hidden="true" />
          <span className="text-lg font-black text-slate-900 dark:text-slate-100">{formatAudioTime(elapsedSeconds)}</span>
          <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">
            {t.practice.listeningTimeStat}
          </span>
        </div>
      </div>

      {/* Primary CTAs: continuing forward is what most learners want next,
          so Replay Mistakes + Next Lesson sit together as the prominent
          pair rather than a full Replay Lesson restart. */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {hasMistakes && (
          <button
            type="button"
            onClick={onReplayMistakes}
            className="px-5 py-2.5 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl text-sm font-bold hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            {t.practice.listeningReplayMistakes}
          </button>
        )}
        {nextLesson && (
          <Link
            to={`/practice/listening/${nextLesson.id}`}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {t.practice.listeningNextLessonAction}
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onReplayLesson}
          className="px-4 py-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 rounded-xl text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {t.practice.listeningReplayLesson}
        </button>
        <button
          type="button"
          onClick={onBackToLessons}
          className="px-4 py-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 rounded-xl text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {t.practice.listeningBackToLessons}
        </button>
      </div>

      {suggested.length > 0 && (
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-left">
          <p className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 mb-3">
            {t.practice.listeningSuggestedNextTitle}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {suggested.map((l) => (
              <Link
                key={l.id}
                to={`/practice/listening/${l.id}`}
                className="group bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-500/40 transition-all overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <div className="relative h-16 bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center">
                  <Headphones size={20} className="text-white/90" aria-hidden="true" />
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-white/90 dark:bg-slate-950/80 text-blue-600 dark:text-blue-300 text-[9px] font-black rounded uppercase">
                    {l.level}
                  </span>
                </div>
                <div className="p-2.5 space-y-0.5">
                  <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {l.title}
                  </p>
                  <div className="flex items-center gap-x-2 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <ListOrdered size={10} aria-hidden="true" />
                      {l.segmentCount} {t.practice.sentencesUnit}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock size={10} aria-hidden="true" />
                      {l.estimatedMinutes} {t.lesson.minutesUnit}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ListeningSessionSummary;
