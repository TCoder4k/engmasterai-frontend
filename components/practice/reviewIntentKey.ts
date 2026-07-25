import { useCallback, useRef } from 'react';
import type { ReviewRating } from '../../services/learningService';

/**
 * Produces a STABLE `clientReviewId` per rating intent.
 *
 * The backend deduplicates review submissions on `(userId, clientReviewId)`:
 * replaying a key returns the original recorded outcome instead of applying
 * a second review. That only works if a retry sends the SAME key.
 *
 * Every rating surface originally minted `crypto.randomUUID()` inline at the
 * call site, so a retry after a timeout or a version conflict sent a brand
 * new key — meaning the idempotency guard provided no protection at exactly
 * the moment it was needed, and a slow-network double-submit could apply two
 * reviews and grow the interval twice.
 *
 * Here, an "intent" is one (word, rating) pair. Retrying the same intent
 * reuses its key; picking a different rating, or moving to a different word,
 * is a genuinely new intent and mints a new one. `clear()` is called once a
 * submission has definitively resolved.
 */
export const useReviewIntentKey = () => {
  const pendingRef = useRef<{ wordId: string; rating: ReviewRating; clientReviewId: string } | null>(null);

  const resolve = useCallback((wordId: string, rating: ReviewRating): string => {
    const pending = pendingRef.current;
    if (pending && pending.wordId === wordId && pending.rating === rating) {
      return pending.clientReviewId;
    }
    const clientReviewId = crypto.randomUUID();
    pendingRef.current = { wordId, rating, clientReviewId };
    return clientReviewId;
  }, []);

  const clear = useCallback(() => {
    pendingRef.current = null;
  }, []);

  return { resolve, clear };
};
