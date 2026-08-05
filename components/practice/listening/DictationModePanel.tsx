import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Headphones } from 'lucide-react';
import EmptyState from '../../shared/EmptyState';
import DictationWorkspace, {
  SegmentSolvedResult,
  WorkspaceFontSize,
} from './DictationWorkspace';
import ListeningSessionSummary from './ListeningSessionSummary';
import { useListeningContent } from './ListeningContentPage';
import { useTranslation } from '../../../i18n/useTranslation';

interface DictationResult {
  totalSegments: number;
  assistedCount: number;
  wordsCorrect: number;
  wordsTotal: number;
  elapsedSeconds: number;
}

// Sprint 11 Phase 2 — the Dictation exercise, now a child of the shared
// content layout instead of a whole page.
//
// WHAT MOVED OUT. The media player, the sentence list and sentence selection
// belong to ListeningContentPage and are shared with every future mode; this
// panel keeps only what is specific to typing what you hear.
//
// WHAT DID NOT CHANGE. Grading is still the live word diff inside
// DictationWorkspace, and it is still session-only: nothing is posted, nothing
// is persisted, and a refresh legitimately starts over. Phase 4A moves that
// judgement to the server. Until then this panel must not display anything
// that looks like saved progress.
//
// AUDIO NOW COMES FROM THE RECORDING, NOT FROM TTS. The old page spoke each
// sentence with the browser's speech synthesiser because the seed content had
// no media. Playback controls here delegate to the real player through the
// layout, which is the entire point of Phase 2 — the student practises against
// the actual audio a teacher chose.
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
    // A manual click is always a later, separate event from whatever effect
    // last updated wordStats/assistedSegmentIds/solvedSegmentIds, so reading
    // current state directly is safe here (unlike the scheduled path below,
    // which must capture the post-update values up front to avoid a stale
    // closure).
    const target = nextUnsolvedIndex(solvedSegmentIds, currentIndex);
    if (target === -1) {
      finish(assistedSegmentIds.size, wordStats.correct, wordStats.total);
    } else {
      goToSegment(target);
    }
  };

  const handleSegmentSolved = (solvedResult: SegmentSolvedResult) => {
    // The post-update set, computed here rather than read from state: the
    // scheduled auto-advance below runs after this function returns but was
    // created with THIS render's closure, so `solvedSegmentIds` would still be
    // missing the sentence that was just solved.
    const solvedAfter = new Set(solvedSegmentIds).add(segment.id);
    setSolvedSegmentIds(solvedAfter);

    const assistedCountAfter = solvedResult.assisted
      ? assistedSegmentIds.size + (assistedSegmentIds.has(segment.id) ? 0 : 1)
      : assistedSegmentIds.size;
    const wordsCorrectAfter = wordStats.correct + solvedResult.wordsCorrect;
    const wordsTotalAfter = wordStats.total + solvedResult.wordsTotal;

    if (solvedResult.assisted) {
      setAssistedSegmentIds((prev) => new Set(prev).add(segment.id));
    }
    setWordStats({ correct: wordsCorrectAfter, total: wordsTotalAfter });

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
        onPlayPause={togglePlay}
        onReplay={replaySegment}
      />

      {/* Stated on the exercise itself, not only on the summary: a student who
          never finishes must still know nothing was saved. */}
      <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
        {t.practice.listeningSessionOnlyNote}
      </p>
    </div>
  );
};

export default DictationModePanel;
