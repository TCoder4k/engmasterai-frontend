import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Headphones } from 'lucide-react';
import StudentLayout from '../../user/StudentLayout';
import EmptyState from '../../shared/EmptyState';
import SegmentPlayer from './SegmentPlayer';
import DictationWorkspace, { SegmentSolvedResult, WorkspaceFontSize } from './DictationWorkspace';
import SubtitlesSidebar from './SubtitlesSidebar';
import ListeningSessionSummary from './ListeningSessionSummary';
import SoundToggle from '../../shared/SoundToggle';
import { useTranslation } from '../../../i18n/useTranslation';
import { isTtsSupported, speakText, cancelSpeech } from '../../../services/tts';
import { getLessonById, LISTENING_CONTENT_VERSION } from './listeningContent';
import { recordListeningSession } from './listeningSessionStore';

interface ListeningResult {
  totalSegments: number;
  assistedCount: number;
  wordsCorrect: number;
  wordsTotal: number;
  elapsedSeconds: number;
}

// /practice/listening/:lessonId — the keyboard-first dictation exercise
// (Sprint 03E; the lesson picker moved to the catalog at
// /practice/listening). Dictation sub-mode only; shadowing was never
// ported (fake AI scoring). Content is temporary, self-authored seed data
// (LISTENING_CONTENT_VERSION) pending a real backend transcript model.
// Session activity is recorded to the in-memory listeningSessionStore for
// the catalog's Continue section — never persisted, by design.
const ListeningLessonPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { lessonId } = useParams<{ lessonId: string }>();

  const lesson = lessonId ? getLessonById(lessonId) : undefined;

  const [segmentIndex, setSegmentIndex] = useState(0);
  const [solvedSegmentIds, setSolvedSegmentIds] = useState<Set<number>>(new Set());
  const [assistedSegmentIds, setAssistedSegmentIds] = useState<Set<number>>(new Set());
  const [savedSentenceIds, setSavedSentenceIds] = useState<Set<number>>(new Set());
  const [isPlaying, setIsPlaying] = useState(false);
  const [replayingSegmentIndex, setReplayingSegmentIndex] = useState<number | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [hideTranslation, setHideTranslation] = useState(false);
  const [fontSize, setFontSize] = useState<WorkspaceFontSize>('large');
  const [listeningResult, setListeningResult] = useState<ListeningResult | null>(null);
  // Real, this-attempt word counts (Sprint 03G) — accumulated across
  // segments as they're solved, never fabricated.
  const [wordStats, setWordStats] = useState({ correct: 0, total: 0 });
  const lessonStartRef = useRef<number>(Date.now());
  // Sprint 03F: untracked before — nothing cancelled this if the user
  // manually advanced before it fired, risking a double-advance.
  const autoAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Defensive clamp: a lesson-to-lesson navigation (via a suggested-lesson
  // link) reuses this mounted component with a new lessonId param before
  // the reset effect below has run, so segmentIndex could momentarily be
  // out of bounds for the new lesson's segment count.
  const segmentIndexClamped = lesson ? Math.min(segmentIndex, lesson.segments.length - 1) : 0;
  const segment = lesson?.segments[segmentIndexClamped];
  const ttsSupported = isTtsSupported();

  const clearAutoAdvanceTimer = () => {
    if (autoAdvanceTimeoutRef.current !== null) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
  };

  // Sprint 03G: navigating from one lesson's completion screen straight
  // into another lesson (via "Next Lesson" / a suggested-lesson card) is
  // the first path that changes `lessonId` on an already-mounted instance
  // of this page — React Router reuses the component rather than
  // remounting it. Deliberately NOT solved via a `key`-forced remount (the
  // user's call): an explicit reset keeps this page free to hold state
  // later that shouldn't reset on lesson navigation (analytics, audio
  // cache, etc), at the cost of listing every reset by hand here.
  useEffect(() => {
    setSegmentIndex(0);
    setSolvedSegmentIds(new Set());
    setAssistedSegmentIds(new Set());
    setSavedSentenceIds(new Set());
    setWordStats({ correct: 0, total: 0 });
    setListeningResult(null);
    lessonStartRef.current = Date.now();
    clearAutoAdvanceTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  useEffect(() => {
    setIsPlaying(false);
    setReplayingSegmentIndex(null);
    clearAutoAdvanceTimer();
    // Never autoplay on segment change — playback only ever starts from an
    // explicit user gesture (locked TTS discipline).
    return () => cancelSpeech();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentIndex, lessonId]);

  useEffect(() => clearAutoAdvanceTimer, []);

  // Record real session-only activity for the catalog's Continue section.
  useEffect(() => {
    if (!lesson) return;
    recordListeningSession({
      lessonId: lesson.id,
      lastSegmentIndex: segmentIndex,
      solvedSegmentIds: [...solvedSegmentIds],
      assistedSegmentIds: [...assistedSegmentIds],
      totalSegments: lesson.segments.length,
      updatedAt: Date.now(),
    });
  }, [lesson, segmentIndex, solvedSegmentIds, assistedSegmentIds]);

  if (!lesson || !segment) {
    return (
      <StudentLayout>
        <div className="max-w-3xl mx-auto space-y-4">
          <Link
            to="/practice/listening"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-indigo-500 dark:text-slate-500 dark:hover:text-indigo-400 transition-colors min-h-[44px]"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span>{t.practice.backToListening}</span>
          </Link>
          <EmptyState icon={<Headphones size={32} />} message={t.practice.lessonNotFound} />
        </div>
      </StudentLayout>
    );
  }

  const speakCurrent = () => {
    speakText(segment.textEn, {
      rate: playbackRate,
      onStart: () => setIsPlaying(true),
      onEnd: () => setIsPlaying(false),
      onError: () => setIsPlaying(false),
    });
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      cancelSpeech();
      setIsPlaying(false);
    } else {
      speakCurrent();
    }
  };

  const handleReplay = () => {
    cancelSpeech();
    speakCurrent();
  };

  // Replaying an already-solved sidebar segment is pure audio playback of
  // real content — it never touches segmentIndex, solvedSegmentIds, or any
  // other progress state.
  const handleReplaySegment = (idx: number) => {
    cancelSpeech();
    const target = lesson.segments[idx];
    speakText(target.textEn, {
      rate: playbackRate,
      onStart: () => setReplayingSegmentIndex(idx),
      onEnd: () => setReplayingSegmentIndex(null),
      onError: () => setReplayingSegmentIndex(null),
    });
  };

  const goToSegment = (index: number) => {
    if (index < 0 || index >= lesson.segments.length) return;
    setSegmentIndex(index);
  };

  const finishLesson = (assistedCount: number, wordsCorrect: number, wordsTotal: number) => {
    cancelSpeech();
    setIsPlaying(false);
    const elapsedSeconds = Math.round((Date.now() - lessonStartRef.current) / 1000);
    setListeningResult({ totalSegments: lesson.segments.length, assistedCount, wordsCorrect, wordsTotal, elapsedSeconds });
  };

  const handleAdvance = () => {
    clearAutoAdvanceTimer();
    if (segmentIndex < lesson.segments.length - 1) {
      goToSegment(segmentIndex + 1);
    } else {
      // A manual click is always a later, separate event from whatever
      // effect last updated wordStats/assistedSegmentIds, so reading the
      // current state directly here is safe (unlike the scheduled
      // auto-advance path below, which must capture plain numbers up
      // front to avoid a stale closure).
      finishLesson(assistedSegmentIds.size, wordStats.correct, wordStats.total);
    }
  };

  const handleSegmentSolved = (result: SegmentSolvedResult) => {
    setSolvedSegmentIds((prev) => new Set(prev).add(segment.id));
    // Compute what the aggregated state WILL BE once the setters below
    // flush — a callback scheduled from this same synchronous call would
    // otherwise read stale (one-behind) values.
    const assistedCountAfter = result.assisted
      ? assistedSegmentIds.size + (assistedSegmentIds.has(segment.id) ? 0 : 1)
      : assistedSegmentIds.size;
    const wordsCorrectAfter = wordStats.correct + result.wordsCorrect;
    const wordsTotalAfter = wordStats.total + result.wordsTotal;

    if (result.assisted) {
      setAssistedSegmentIds((prev) => new Set(prev).add(segment.id));
    }
    setWordStats({ correct: wordsCorrectAfter, total: wordsTotalAfter });

    if (autoAdvance) {
      clearAutoAdvanceTimer();
      if (segmentIndex < lesson.segments.length - 1) {
        autoAdvanceTimeoutRef.current = setTimeout(() => goToSegment(segmentIndex + 1), 1200);
      } else {
        autoAdvanceTimeoutRef.current = setTimeout(
          () => finishLesson(assistedCountAfter, wordsCorrectAfter, wordsTotalAfter),
          1200,
        );
      }
    }
  };

  const handleReplayMistakes = () => {
    const mistakeIds = assistedSegmentIds;
    setSolvedSegmentIds(new Set(lesson.segments.map((s) => s.id).filter((id) => !mistakeIds.has(id))));
    setAssistedSegmentIds(new Set());
    setWordStats({ correct: 0, total: 0 });
    lessonStartRef.current = Date.now();
    const firstMistakeIndex = lesson.segments.findIndex((s) => mistakeIds.has(s.id));
    setSegmentIndex(firstMistakeIndex === -1 ? 0 : firstMistakeIndex);
    setListeningResult(null);
  };

  const handleReplayLesson = () => {
    setSegmentIndex(0);
    setSolvedSegmentIds(new Set());
    setAssistedSegmentIds(new Set());
    setWordStats({ correct: 0, total: 0 });
    lessonStartRef.current = Date.now();
    setListeningResult(null);
  };

  const handleBackToLessons = () => navigate('/practice/listening');

  const toggleSaveSentence = () => {
    setSavedSentenceIds((prev) => {
      const next = new Set(prev);
      if (next.has(segment.id)) next.delete(segment.id);
      else next.add(segment.id);
      return next;
    });
  };

  return (
    <StudentLayout>
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/practice/listening')}
              aria-label={t.practice.backToListening}
              className="shrink-0 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black rounded-md uppercase">
                  {lesson.level}
                </span>
                <h1 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 truncate">
                  {lesson.title}
                </h1>
              </div>
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-1">
                {lesson.topic} · {t.practice.listeningSeedNotice}{' '}
                <span className="font-mono text-slate-300 dark:text-slate-600">({LISTENING_CONTENT_VERSION})</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <label
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-indigo-400 ${
                autoAdvance
                  ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <input
                type="checkbox"
                checked={autoAdvance}
                onChange={(e) => setAutoAdvance(e.target.checked)}
                className="accent-indigo-500 w-4 h-4"
              />
              <span>{t.practice.listeningAutoAdvance}</span>
            </label>
            <label
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-indigo-400 ${
                hideTranslation
                  ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <input
                type="checkbox"
                checked={hideTranslation}
                onChange={(e) => setHideTranslation(e.target.checked)}
                className="accent-indigo-500 w-4 h-4"
              />
              <span>{t.practice.listeningHideTranslation}</span>
            </label>
            <SoundToggle />
          </div>
        </div>

        {listeningResult ? (
          <ListeningSessionSummary
            lesson={lesson}
            totalSegments={listeningResult.totalSegments}
            assistedCount={listeningResult.assistedCount}
            wordsCorrect={listeningResult.wordsCorrect}
            wordsTotal={listeningResult.wordsTotal}
            elapsedSeconds={listeningResult.elapsedSeconds}
            onReplayMistakes={handleReplayMistakes}
            onReplayLesson={handleReplayLesson}
            onBackToLessons={handleBackToLessons}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm p-6">
                <SegmentPlayer
                  isPlaying={isPlaying}
                  playbackRate={playbackRate}
                  ttsSupported={ttsSupported}
                  onPlayPause={handlePlayPause}
                  onReplay={handleReplay}
                  onSpeedChange={setPlaybackRate}
                />
              </div>

              <DictationWorkspace
                key={segment.id}
                segment={segment}
                segmentNumber={segmentIndexClamped + 1}
                totalSegments={lesson.segments.length}
                fontSize={fontSize}
                onFontSizeChange={setFontSize}
                isSentenceSaved={savedSentenceIds.has(segment.id)}
                onToggleSaveSentence={toggleSaveSentence}
                onSegmentSolved={handleSegmentSolved}
                onAdvance={handleAdvance}
                onPlayPause={handlePlayPause}
                onReplay={handleReplay}
              />
            </div>

            <div>
              <SubtitlesSidebar
                lesson={lesson}
                currentSegmentIndex={segmentIndexClamped}
                solvedSegmentIds={solvedSegmentIds}
                assistedSegmentIds={assistedSegmentIds}
                hideTranslation={hideTranslation}
                isPlaying={isPlaying}
                replayingSegmentIndex={replayingSegmentIndex}
                onSelectSegment={goToSegment}
                onReplaySegment={handleReplaySegment}
              />
            </div>
          </div>
        )}
      </div>
    </StudentLayout>
  );
};

export default ListeningLessonPage;
