import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getDueReviews,
  submitReview,
  isVersionConflict,
  isIdempotencyKeyReused,
  DueQueueItem,
  ReviewRating,
} from '../../../services/learningService';
import { useReviewIntentKey } from '../reviewIntentKey';

// How many positions ahead an AGAIN-rated word resurfaces in THIS session's
// local queue.
const REQUEUE_OFFSET = 3;

// A queue entry. `isRetrain` marks a card that resurfaced after an AGAIN:
// it is a recall check, NOT a second review — see `rate()` below and the
// ADR's "AGAIN requeue, Option A" decision.
export interface ReviewQueueEntry {
  item: DueQueueItem;
  isRetrain: boolean;
}

export interface RatingCounts {
  AGAIN: number;
  HARD: number;
  GOOD: number;
  EASY: number;
}

const EMPTY_RATING_COUNTS: RatingCounts = { AGAIN: 0, HARD: 0, GOOD: 0, EASY: 0 };

interface UseReviewSessionArgs {
  deckId?: string;
  libraryId?: string;
}

// Backend-driven review session state (Sprint 04D, §15) — deliberately NOT
// an extension of useVocabSession (see that hook's own header comment):
// this one is server-authoritative (every rating is a real POST, the queue
// itself comes from GET /learning/reviews/due) rather than a client-side
// score tally over caller-supplied words.
export const useReviewSession = ({ deckId, libraryId }: UseReviewSessionArgs) => {
  const [queue, setQueue] = useState<ReviewQueueEntry[]>([]);
  const [initialTotal, setInitialTotal] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [retrainedCount, setRetrainedCount] = useState(0);
  const [ratingCounts, setRatingCounts] = useState<RatingCounts>(EMPTY_RATING_COUNTS);
  const [newlyLearnedCount, setNewlyLearnedCount] = useState(0);
  const [masteredCount, setMasteredCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [completedAt, setCompletedAt] = useState<number | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Guards the in-flight submission. A ref, not the `isSubmitting` state:
  // state is captured by value in the `rate` closure, so two events
  // dispatched in the same React batch would both read `false` and both
  // fire a request. A ref is read at call time and closes that window.
  const inFlightRef = useRef(false);

  // Stable idempotency key per (word, rating) intent — see the helper's own
  // doc comment for why a retry MUST reuse the key rather than mint one.
  const { resolve: resolveClientReviewId, clear: clearReviewIntent } = useReviewIntentKey();

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    // Sent on every call, but only ever bootstraps User.timezone the first
    // time it's null (§8/§16) — never re-derives an already-stored value.
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    getDueReviews({ deckId, libraryId, tz, includeNew: true })
      .then((res) => {
        if (cancelled) return;
        setQueue(res.data.map((item) => ({ item, isRetrain: false })));
        setInitialTotal(res.data.length);
        setCurrentIndex(0);
        setReviewedCount(0);
        setRetrainedCount(0);
        setRatingCounts(EMPTY_RATING_COUNTS);
        setNewlyLearnedCount(0);
        setMasteredCount(0);
        setStartedAt(Date.now());
        setCompletedAt(null);
        clearReviewIntent();
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load due reviews');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId, libraryId, reloadToken]);

  const currentEntry = queue[currentIndex] ?? null;
  const currentItem = currentEntry?.item ?? null;
  const isRetrainCard = currentEntry?.isRetrain ?? false;
  const isComplete = !isLoading && initialTotal > 0 && currentIndex >= queue.length;
  const isEmpty = !isLoading && initialTotal === 0;

  // Stamp the completion time exactly once, when the queue runs out, so the
  // elapsed time shown in the summary is the real session duration and does
  // not keep ticking while the summary is on screen.
  useEffect(() => {
    if (isComplete && completedAt === null) setCompletedAt(Date.now());
  }, [isComplete, completedAt]);

  const advance = useCallback(() => {
    setCurrentIndex((i) => i + 1);
  }, []);

  // Advances past a retrain card. No network call, no WordReviewLog, no
  // schedule change — a retrain pass is practice, not a graded review, so
  // it must never grow the word's interval (that is how "Replay mistakes"
  // would otherwise farm scheduling).
  const continueRetrain = useCallback(() => {
    if (!currentEntry?.isRetrain) return;
    setRetrainedCount((c) => c + 1);
    advance();
  }, [currentEntry, advance]);

  const rate = useCallback(
    async (rating: ReviewRating) => {
      if (!currentEntry || inFlightRef.current) return;
      // A retrain card offers no ratings at all — guarded here as well as in
      // the UI so a keyboard shortcut can't bypass the missing buttons.
      if (currentEntry.isRetrain) return;

      const item = currentEntry.item;
      const previousState = item.progress?.state ?? 'NEW';

      inFlightRef.current = true;
      setIsSubmitting(true);
      setError(null);
      try {
        const result = await submitReview(item.word.id, {
          rating,
          practiceMode: 'REVIEW',
          clientReviewId: resolveClientReviewId(item.word.id, rating),
        });

        setReviewedCount((c) => c + 1);
        setRatingCounts((counts) => ({ ...counts, [rating]: counts[rating] + 1 }));

        // Real transitions only, judged against the authoritative response —
        // never assumed from the rating alone.
        if (previousState === 'NEW' && result.state !== 'NEW') setNewlyLearnedCount((c) => c + 1);
        if (previousState !== 'MASTERED' && result.state === 'MASTERED') setMasteredCount((c) => c + 1);

        if (rating === 'AGAIN') {
          setQueue((prev) => {
            const next = [...prev];
            const insertAt = Math.min(currentIndex + 1 + REQUEUE_OFFSET, next.length);
            // Re-queued as a RETRAIN entry: same word, but it will render
            // without rating buttons and will never be submitted again.
            next.splice(insertAt, 0, { item, isRetrain: true });
            return next;
          });
        }

        clearReviewIntent(); // intent satisfied; the next rating is a new one
        advance();
      } catch (err) {
        if (isIdempotencyKeyReused(err)) {
          // A client bug, not a transient condition — surfaced rather than
          // retried, since retrying with the same key would fail identically.
          clearReviewIntent();
          setError(err instanceof Error ? err.message : 'Duplicate review key');
        } else if (!isVersionConflict(err)) {
          setError(err instanceof Error ? err.message : 'Failed to submit review');
        }
        // A version conflict means another request touched this word's
        // progress underneath us. Stay on the same word, keep the pending
        // key, and let the user simply rate again — the retry reuses that
        // key, so it can never double-apply (§10/§14).
      } finally {
        inFlightRef.current = false;
        setIsSubmitting(false);
      }
    },
    [currentEntry, currentIndex, advance, resolveClientReviewId, clearReviewIntent],
  );

  // Re-fetches the queue from the backend and resets every counter. The
  // previous implementation put a changing `key` on a child <div>, which
  // never remounted this hook's owner — so "Review more" did nothing.
  const restart = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  return {
    currentItem,
    isRetrainCard,
    isLoading,
    isComplete,
    isEmpty,
    isSubmitting,
    error,
    reviewedCount,
    retrainedCount,
    ratingCounts,
    againCount: ratingCounts.AGAIN,
    newlyLearnedCount,
    masteredCount,
    elapsedMs: (completedAt ?? Date.now()) - startedAt,
    remainingCount: Math.max(queue.length - currentIndex, 0),
    rate,
    continueRetrain,
    restart,
  };
};
