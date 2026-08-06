import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Headphones, Loader2 } from 'lucide-react';
import EmptyState from '../../shared/EmptyState';
import DictationWorkspace, {
  DictationSubmission,
  WorkspaceFontSize,
} from './DictationWorkspace';
import ListeningSessionSummary from './ListeningSessionSummary';
import { useListeningContent } from './ListeningContentPage';
import { useTranslation } from '../../../i18n/useTranslation';
import { submitDictationAttempt } from '../../../services/listeningService';

interface DictationResult {
  totalSegments: number;
  assistedCount: number;
  wordsCorrect: number;
  wordsTotal: number;
  elapsedSeconds: number;
}

// Sprint 11 Phase 4A — the Dictation exercise, now server-graded and
// server-persisted.
//
// WHAT CHANGED FROM PHASE 2. Solving a sentence used to be a fact this
// component decided and kept in React state; a refresh started the recording
// over. Now the client sends what the student typed, the SERVER decides
// whether it is correct, and the answer is stored. This panel renders the
// server's verdict; it never computes one.
//
// THE LIVE WORD DIFF STAYS, and it is not a contradiction. Colouring words as
// you type is feedback, and feedback may be approximate. A score may not.
// DictationWorkspace's diff folds words with the same rules as the server's
// normalizer so the two agree, but where they ever DISAGREE the server wins
// and `submitError` says so out loud — see `handleSegmentSolved`.
//
// THERE IS NO SESSION FALLBACK. `listeningSessionStore.ts` was deleted in
// Phase 2 and nothing replaced it. If a submission fails, the sentence is not
// marked solved and the student is told; it is never optimistically accepted
// and quietly lost, which is the failure mode that made Sprint 08's silent
// fallback worth removing everywhere it appeared.
const DictationModePanel: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    content,
    currentIndex,
    goToSegment,
    togglePlay,
    replaySegment,
    solvedSegmentIds,
    setSolvedSegmentIds,
    assistedSegmentIds,
    setAssistedSegmentIds,
    setStudyActive,
  } = useListeningContent();

  const segments = content.segments;
  const segment = segments[currentIndex];

  const [savedSentenceIds, setSavedSentenceIds] = useState<Set<string>>(new Set());
  const [fontSize, setFontSize] = useState<WorkspaceFontSize>('large');
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [wordStats, setWordStats] = useState({ correct: 0, total: 0 });
  const [result, setResult] = useState<DictationResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingRetry, setPendingRetry] = useState<DictationSubmission | null>(null);
  const startedAtRef = useRef<number>(Date.now());
  // Sprint 03F: untracked before — nothing cancelled this if the student
  // advanced manually before it fired, risking a double-advance.
  const autoAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoAdvanceTimer = () => {
    if (autoAdvanceTimeoutRef.current !== null) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
  };

  useEffect(() => clearAutoAdvanceTimer, []);

  // A finished session is not studying — stop crediting study time until the
  // student starts again.
  useEffect(() => {
    setStudyActive(result === null);
  }, [result, setStudyActive]);

  useEffect(() => {
    clearAutoAdvanceTimer();
    setSubmitError(null);
    setPendingRetry(null);
  }, [currentIndex]);

  if (segments.length === 0 || !segment) {
    return (
      <EmptyState
        icon={<Headphones size={32} />}
        message={t.practice.listeningNoSegments}
      />
    );
  }

  const finish = (assistedCount: number, wordsCorrect: number, wordsTotal: number) => {
    setResult({
      totalSegments: segments.length,
      assistedCount,
      wordsCorrect,
      wordsTotal,
      elapsedSeconds: Math.round((Date.now() - startedAtRef.current) / 1000),
    });
  };

  /**
   * The next sentence still to be solved, searching forward and wrapping.
   * `-1` means every sentence is done.
   *
   * A MODE IS COMPLETE ONLY WHEN EVERY SENTENCE IS, and this is what enforces
   * it. The previous rule was positional — reaching the last sentence ended the
   * session — which was survivable only while the sole way to move was Next.
   * Once a student can jump straight to sentence 3 from the list, solving it
   * would have ended the recording with sentences 1 and 2 untouched and shown a
   * summary reading "3/3". Wrapping sends them back to the real remaining work
   * instead.
   */
  const nextUnsolvedIndex = (solved: Set<string>, fromIndex: number): number => {
    for (let step = 1; step <= segments.length; step++) {
      const candidate = (fromIndex + step) % segments.length;
      if (!solved.has(segments[candidate].id)) return candidate;
    }
    return -1;
  };

  const handleAdvance = () => {
    clearAutoAdvanceTimer();
    // A manual click is always a later, separate event than whatever effect
    // last updated the solved set, so reading current state directly is safe
    // here (unlike the scheduled path below, which must capture the
    // post-update values up front to avoid a stale closure).
    const target = nextUnsolvedIndex(solvedSegmentIds, currentIndex);
    if (target === -1) {
      finish(assistedSegmentIds.size, wordStats.correct, wordStats.total);
    } else {
      goToSegment(target);
    }
  };

  /**
   * Send the attempt and let the server decide.
   *
   * Every number below comes off the response. Nothing is added to the solved
   * set until the server has said the sentence is solved — including the case
   * where the browser's live diff was satisfied and the server was not, which
   * is exactly the divergence that would otherwise show a student a green tick
   * for work that was never recorded.
   */
  const submit = async (submission: DictationSubmission) => {
    setSaving(true);
    setSubmitError(null);
    try {
      const outcome = await submitDictationAttempt(segment.id, {
        // A fresh key per attempt. Retrying a failed request reuses the key
        // held in `pendingRetry`, so a submission that reached the server but
        // lost its response is replayed rather than double-counted.
        clientAttemptId: crypto.randomUUID(),
        typedText: submission.typedText,
        revealedWordCount: submission.revealedWordCount,
      });

      if (!outcome.solved) {
        // The server graded it and said no. Say so rather than pretending.
        setSubmitError(t.practice.listeningNotAcceptedError);
        setPendingRetry(null);
        return;
      }

      const solvedAfter = new Set(solvedSegmentIds).add(segment.id);
      setSolvedSegmentIds(solvedAfter);
      if (outcome.assisted) {
        setAssistedSegmentIds((prev) => new Set(prev).add(segment.id));
      }

      // Server word counts, not the browser's. `wordsCorrect` already excludes
      // revealed words, so the summary cannot flatter a student who revealed
      // their way through.
      const wordsCorrectAfter = wordStats.correct + outcome.wordsCorrect;
      const wordsTotalAfter = wordStats.total + outcome.wordsTotal;
      setWordStats({ correct: wordsCorrectAfter, total: wordsTotalAfter });

      const assistedCountAfter =
        outcome.assisted && !assistedSegmentIds.has(segment.id)
          ? assistedSegmentIds.size + 1
          : assistedSegmentIds.size;

      if (autoAdvance) {
        clearAutoAdvanceTimer();
        // Same completion rule as the manual path — auto-advance must not be a
        // second way to reach the summary early.
        const target = nextUnsolvedIndex(solvedAfter, currentIndex);
        autoAdvanceTimeoutRef.current = setTimeout(() => {
          if (target === -1) {
            finish(assistedCountAfter, wordsCorrectAfter, wordsTotalAfter);
          } else {
            goToSegment(target);
          }
        }, 1200);
      }
    } catch (caught) {
      setSubmitError(
        caught instanceof Error ? caught.message : t.practice.listeningSaveError,
      );
      setPendingRetry(submission);
    } finally {
      setSaving(false);
    }
  };

  const handleSegmentSolved = (submission: DictationSubmission) => {
    void submit(submission);
  };

  const handleReplayMistakes = () => {
    const mistakeIds = assistedSegmentIds;
    setSolvedSegmentIds(
      new Set(segments.map((s) => s.id).filter((id) => !mistakeIds.has(id))),
    );
    setAssistedSegmentIds(new Set());
    setWordStats({ correct: 0, total: 0 });
    startedAtRef.current = Date.now();
    const firstMistakeIndex = segments.findIndex((s) => mistakeIds.has(s.id));
    goToSegment(firstMistakeIndex === -1 ? 0 : firstMistakeIndex);
    setResult(null);
  };

  const handleReplayAll = () => {
    setSolvedSegmentIds(new Set());
    setAssistedSegmentIds(new Set());
    setWordStats({ correct: 0, total: 0 });
    startedAtRef.current = Date.now();
    goToSegment(0);
    setResult(null);
  };

  const toggleSaveSentence = () => {
    setSavedSentenceIds((prev) => {
      const next = new Set(prev);
      if (next.has(segment.id)) next.delete(segment.id);
      else next.add(segment.id);
      return next;
    });
  };

  if (result) {
    return (
      <ListeningSessionSummary
        title={content.title}
        level={content.level}
        categoryName={content.category.name}
        totalSegments={result.totalSegments}
        assistedCount={result.assistedCount}
        wordsCorrect={result.wordsCorrect}
        wordsTotal={result.wordsTotal}
        elapsedSeconds={result.elapsedSeconds}
        onReplayMistakes={handleReplayMistakes}
        onReplayLesson={handleReplayAll}
        onBackToLessons={() => navigate('/practice/listening')}
      />
    );
  }

  return (
    <div className="space-y-4">
      <label
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer text-xs font-semibold transition-colors focus-within:ring-2 focus-within:ring-blue-400 ${
          autoAdvance
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300'
            : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
        }`}
      >
        <input
          type="checkbox"
          checked={autoAdvance}
          onChange={(event) => setAutoAdvance(event.target.checked)}
          className="accent-blue-500 w-4 h-4"
        />
        <span>{t.practice.listeningAutoAdvance}</span>
      </label>

      <DictationWorkspace
        key={segment.id}
        segment={segment}
        segmentNumber={currentIndex + 1}
        totalSegments={segments.length}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        isSentenceSaved={savedSentenceIds.has(segment.id)}
        onToggleSaveSentence={toggleSaveSentence}
        onSegmentSolved={handleSegmentSolved}
        onAdvance={handleAdvance}
        saving={saving}
        onPlayPause={togglePlay}
        onReplay={replaySegment}
      />

      {saving && (
        <p
          role="status"
          aria-live="polite"
          className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500"
        >
          <Loader2 size={13} aria-hidden="true" className="motion-safe:animate-spin" />
          <span>{t.practice.listeningSaving}</span>
        </p>
      )}

      {submitError && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl border-2 border-amber-200 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10"
        >
          <AlertCircle
            size={14}
            aria-hidden="true"
            className="text-amber-700 dark:text-amber-400 shrink-0"
          />
          <span className="text-[12px] font-semibold text-amber-800 dark:text-amber-300">
            {submitError}
          </span>
          {/* Retry only exists for a request that FAILED. A sentence the
              server graded and rejected has nothing to retry — the student
              has to correct their answer. */}
          {pendingRetry && (
            <button
              type="button"
              onClick={() => void submit(pendingRetry)}
              disabled={saving}
              className="ml-auto px-3 py-1.5 min-h-[36px] rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-500/50 text-amber-800 dark:text-amber-300 text-[11px] font-bold hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              {t.common.tryAgain}
            </button>
          )}
        </div>
      )}

      <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
        {t.practice.listeningProgressSavedNote}
      </p>
    </div>
  );
};

export default DictationModePanel;
