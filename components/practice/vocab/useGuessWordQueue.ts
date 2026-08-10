import { useCallback, useEffect, useRef, useState } from 'react';
import { VocabWordListItem } from '../../../types';
import { shuffleArray } from '../shuffle';
import {
  getDeckGuessProgress,
  markGuessWordLearned,
  resetDeckGuessProgress,
} from '../../../services/vocabGuessProgressService';

// Same idea as useReviewSession's REQUEUE_OFFSET for an AGAIN-rated card —
// a wrong/skipped word doesn't leave the round, it just moves a few
// positions back so the SAME word isn't immediately re-asked. Purely
// local: nothing is persisted for "not learned yet" (see
// vocabGuessProgressService's own comment on why there is no such call).
const REQUEUE_OFFSET = 3;

const requeue = (queue: VocabWordListItem[]): VocabWordListItem[] => {
  if (queue.length <= 1) return queue;
  const [head, ...rest] = queue;
  const insertAt = Math.min(REQUEUE_OFFSET, rest.length);
  return [...rest.slice(0, insertAt), head, ...rest.slice(insertAt)];
};

// Deck-scoped, persistent-progress-aware queue for the "Guess the Word"
// practice mode. Deliberately its OWN hook, not an extension of
// useVocabSession — reload must exclude already-learned words (server
// state, fetched here), wrong/skip requeues locally with no backend call,
// and "learned" is a fact the SERVER decides (markGuessWordLearned), never
// something this hook computes itself.
export const useGuessWordQueue = (deckId: string, words: VocabWordListItem[]) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<VocabWordListItem[]>([]);
  const [learnedThisSessionCount, setLearnedThisSessionCount] = useState(0);
  const [struggled, setStruggled] = useState<Set<string>>(new Set());
  // Words rarely change identity mid-session (the parent fetches them
  // once), but reading through a ref keeps loadQueue/restartFull stable
  // without needing `words` in their own dependency arrays.
  const wordsRef = useRef(words);
  wordsRef.current = words;

  const loadQueue = useCallback(
    async (pool: VocabWordListItem[]) => {
      setIsLoading(true);
      setError(null);
      try {
        const progress = await getDeckGuessProgress(deckId);
        const learnedIds = new Set(progress.learnedWordIds);
        setQueue(shuffleArray(pool.filter((word) => !learnedIds.has(word.id))));
      } catch {
        setError('Failed to load progress');
      } finally {
        setIsLoading(false);
      }
    },
    [deckId],
  );

  useEffect(() => {
    setLearnedThisSessionCount(0);
    setStruggled(new Set());
    loadQueue(wordsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId, loadQueue]);

  const currentWord = queue[0] ?? null;

  // A plain retry for a failed fetch — unlike restartFull, this never
  // touches the server's progress, only re-attempts the read.
  const retry = () => {
    loadQueue(wordsRef.current);
  };

  // Optimistic locally (the word leaves the queue immediately, keeping the
  // session responsive) — the write is fire-and-forget: if it fails, the
  // word's persisted state simply never changed, so it correctly reappears
  // in a future session's queue rather than leaving this one stuck.
  const answerCorrect = (wordId: string) => {
    setQueue((q) => q.slice(1));
    setLearnedThisSessionCount((c) => c + 1);
    markGuessWordLearned(deckId, wordId).catch(() => {});
  };

  const answerWrongOrSkip = (wordId: string) => {
    setStruggled((s) => (s.has(wordId) ? s : new Set(s).add(wordId)));
    setQueue(requeue);
  };

  // "Ôn từ sai / đã bỏ qua" — session-only by design (confirmed with the
  // product owner): a reload does not need to reconstruct which words were
  // once missed, so this needs no backend call, only the local `struggled`
  // set from the run that just finished.
  const restartStruggled = () => {
    const struggledWords = wordsRef.current.filter((word) => struggled.has(word.id));
    setQueue(shuffleArray(struggledWords));
    setLearnedThisSessionCount(0);
    setStruggled(new Set());
  };

  // "Học lại toàn bộ" — destructive; the caller must confirm before calling
  // this. Resets the SERVER'S learned flags for this deck (a DELETE, not a
  // locally-faked restart), then reloads the full queue from scratch so a
  // reload afterward genuinely shows 0/N again.
  const restartFull = async () => {
    await resetDeckGuessProgress(deckId);
    await loadQueue(wordsRef.current);
    setLearnedThisSessionCount(0);
    setStruggled(new Set());
  };

  return {
    currentWord,
    totalWords: words.length,
    remainingCount: queue.length,
    learnedThisSessionCount,
    struggledCount: struggled.size,
    isLoading,
    error,
    isComplete: !isLoading && !error && queue.length === 0,
    answerCorrect,
    answerWrongOrSkip,
    restartStruggled,
    restartFull,
    retry,
  };
};
