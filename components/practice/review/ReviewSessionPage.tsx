import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Volume2, CheckCircle2, RotateCcw } from 'lucide-react';
import StudentLayout from '../../user/StudentLayout';
import EmptyState from '../../shared/EmptyState';
import ErrorState from '../../shared/ErrorState';
import Skeleton from '../../shared/Skeleton';
import CelebrationBurst from '../CelebrationBurst';
import RatingButtons from '../vocab/RatingButtons';
import ReviewSessionSummary from './ReviewSessionSummary';
import { useReviewSession } from './useReviewSession';
import { useTranslation } from '../../../i18n/useTranslation';
import { isTtsSupported, speakText } from '../../../services/tts';
import { getWord } from '../../../services/vocabWordService';
import { VocabWordExample } from '../../../types';
import { ReviewRating } from '../../../services/learningService';

const RATING_KEYS: Record<string, ReviewRating> = { '1': 'AGAIN', '2': 'HARD', '3': 'GOOD', '4': 'EASY' };

// Highlights the target word/phrase where it literally occurs in the real
// example sentence — identical helper to FlashcardSession's, not shared
// across files to avoid coupling two independently-maintained components
// (same precedent as ListeningSessionSummary not reusing SessionSummary).
const renderHighlightedSentence = (sentence: string, word: string): React.ReactNode => {
  const matchIndex = sentence.toLowerCase().indexOf(word.toLowerCase());
  if (matchIndex === -1) return sentence;
  const before = sentence.slice(0, matchIndex);
  const match = sentence.slice(matchIndex, matchIndex + word.length);
  const after = sentence.slice(matchIndex + word.length);
  return (
    <>
      {before}
      <span className="text-indigo-600 dark:text-indigo-400 underline decoration-2 underline-offset-2">{match}</span>
      {after}
    </>
  );
};

// /practice/review — the dedicated due-review session (Sprint 04D, §15).
// Unlike Flashcard's whole-deck practice, this page loads only what's
// actually due (GET /learning/reviews/due) via useReviewSession, which
// owns all backend-authoritative state; this component is presentation +
// keyboard wiring only.
const ReviewSessionPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const deckId = searchParams.get('deckId') ?? undefined;
  const libraryId = searchParams.get('libraryId') ?? undefined;

  const {
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
    newlyLearnedCount,
    masteredCount,
    elapsedMs,
    remainingCount,
    rate,
    continueRetrain,
    restart,
  } = useReviewSession({ deckId, libraryId });

  const [isFlipped, setIsFlipped] = useState(false);
  const [example, setExample] = useState<VocabWordExample | null>(null);
  const [burstKey, setBurstKey] = useState(0);

  const backHref = libraryId ? `/vocab/libraries/${libraryId}` : deckId ? `/practice/vocab/${deckId}` : '/vocab';

  useEffect(() => {
    setIsFlipped(false);
    setExample(null);
    if (!currentItem) return;
    let ignore = false;
    getWord(currentItem.word.id)
      .then((detail) => {
        if (!ignore) setExample(detail.examples[0] ?? null);
      })
      .catch(() => {
        // Supplementary content only — a failed fetch just means no example
        // section renders.
      });
    return () => {
      ignore = true;
    };
  }, [currentItem?.word.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Never intercept a modified combination — matches the discipline
      // DictationWorkspace's bare-Ctrl replay already established
      // (Sprint 03F): only bare, unmodified keys are ever handled here.
      if (e.ctrlKey || e.metaKey || e.altKey || !currentItem) return;

      if (e.key === ' ') {
        e.preventDefault();
        setIsFlipped((f) => !f);
        return;
      }
      if (!isFlipped) return; // ratings only actionable once the meaning is revealed
      // A retrain card is a recall check, not a graded review — the number
      // keys are inert on it, matching the absent rating buttons. Enter
      // advances instead.
      if (isRetrainCard) {
        if (e.key === 'Enter') {
          e.preventDefault();
          continueRetrain();
        }
        return;
      }
      const rating = RATING_KEYS[e.key];
      if (rating) {
        e.preventDefault();
        rate(rating);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentItem, isFlipped, isRetrainCard, rate, continueRetrain]);

  const handleRate = (rating: ReviewRating) => {
    if (rating !== 'AGAIN') {
      setBurstKey((k) => k + 1);
    }
    rate(rating);
  };

  const handlePlayAudio = () => {
    if (!currentItem) return;
    if (currentItem.word.audioUrl) {
      new Audio(currentItem.word.audioUrl).play().catch(() => {});
    } else {
      speakText(currentItem.word.text);
    }
  };

  return (
    <StudentLayout>
      <div className="max-w-4xl mx-auto space-y-5">
        <Link
          to={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-indigo-500 dark:text-slate-500 dark:hover:text-indigo-400 transition-colors"
        >
          {t.vocab.backToLibrary}
        </Link>

        {isLoading && (
          <div className="space-y-5">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
        )}

        {!isLoading && isEmpty && (
          <EmptyState icon={<CheckCircle2 size={32} />} message={t.practice.reviewAllCaughtUp} />
        )}

        {!isLoading && !isEmpty && isComplete && (
          <ReviewSessionSummary
            reviewedCount={reviewedCount}
            retrainedCount={retrainedCount}
            ratingCounts={ratingCounts}
            newlyLearnedCount={newlyLearnedCount}
            masteredCount={masteredCount}
            elapsedMs={elapsedMs}
            backHref={backHref}
            onRestart={restart}
          />
        )}

        {!isLoading && !isEmpty && !isComplete && currentItem && (
          <div className="space-y-5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 dark:text-slate-500">
              <span>
                {t.practice.reviewedUnit}: {reviewedCount}
              </span>
              <span>
                {t.practice.reviewRemainingLabel}: {remainingCount}
              </span>
            </div>

            {/* A resurfaced AGAIN word. Visually distinct on purpose: it is
                a recall check, submits nothing, and cannot change the
                word's schedule. */}
            {isRetrainCard && (
              <p className="max-w-md mx-auto flex items-center justify-center gap-2 text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-3 py-2 text-center">
                <RotateCcw size={13} aria-hidden="true" />
                {t.practice.retrainBadge}
              </p>
            )}

            {error && (
              <p role="alert" className="text-xs font-semibold text-rose-500 text-center">
                {error}
              </p>
            )}

            <div className="practice-flip-card relative h-80 sm:h-96 max-w-md mx-auto">
              <CelebrationBurst burstKey={burstKey} />
              <div className={`practice-flip-card-inner ${isFlipped ? 'practice-flip-card-flipped' : ''}`}>
                <button
                  type="button"
                  onClick={() => setIsFlipped(true)}
                  aria-label={t.practice.flipCardHint}
                  aria-hidden={isFlipped}
                  tabIndex={isFlipped ? -1 : 0}
                  className="practice-flip-card-face w-full h-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col items-center justify-center gap-3 p-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  {currentItem.word.imageUrl && (
                    <img
                      src={currentItem.word.imageUrl}
                      alt=""
                      aria-hidden="true"
                      className="w-28 h-28 sm:w-32 sm:h-32 object-cover rounded-2xl"
                    />
                  )}
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 text-center">
                    {currentItem.word.text}
                  </p>
                  {currentItem.word.ipa && (
                    <p className="text-sm font-mono text-slate-400 dark:text-slate-500">/{currentItem.word.ipa}/</p>
                  )}
                  {(currentItem.word.audioUrl || isTtsSupported()) && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayAudio();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          e.preventDefault();
                          handlePlayAudio();
                        }
                      }}
                      aria-label={t.practice.playAudio}
                      className="p-2.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors cursor-pointer"
                    >
                      <Volume2 size={18} aria-hidden="true" />
                    </span>
                  )}
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 dark:text-slate-600 mt-1">
                    {t.practice.flipCardVisibleHint}
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500">
                      Space
                    </span>
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFlipped(false)}
                  aria-label={t.practice.flipCardHint}
                  aria-hidden={!isFlipped}
                  tabIndex={isFlipped ? 0 : -1}
                  className="practice-flip-card-face practice-flip-card-face-back w-full h-full bg-white dark:bg-slate-900 border-2 border-indigo-100 dark:border-indigo-500/30 rounded-3xl shadow-sm flex flex-col gap-3 p-5 sm:p-6 overflow-y-auto text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                      {currentItem.word.text}
                    </span>
                    {currentItem.word.ipa && (
                      <span className="text-sm font-mono text-slate-400 dark:text-slate-500">
                        /{currentItem.word.ipa}/
                      </span>
                    )}
                  </div>

                  {currentItem.word.meanings.length === 0 ? (
                    <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">{t.common.noDataYet}</p>
                  ) : (
                    <div>
                      <p className="text-lg sm:text-xl font-extrabold text-amber-600 dark:text-amber-400">
                        {currentItem.word.meanings[0].meaning}
                      </p>
                      {currentItem.word.meanings[1] && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                          {currentItem.word.meanings[1].meaning}
                        </p>
                      )}
                    </div>
                  )}

                  {example && (
                    <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 rounded-2xl p-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mb-1.5">
                        {t.practice.exampleLabel}
                      </p>
                      <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                        &ldquo;{renderHighlightedSentence(example.sentence, currentItem.word.text)}&rdquo;
                      </p>
                      {example.translation && (
                        <p className="text-xs italic text-slate-400 dark:text-slate-500 mt-1.5">
                          &rarr; {example.translation}
                        </p>
                      )}
                    </div>
                  )}
                </button>
              </div>
            </div>

            <div className="max-w-md mx-auto space-y-1.5">
              {isRetrainCard ? (
                // No rating buttons at all on a retrain card — the only
                // action is to move on. Rendering disabled rating buttons
                // instead would imply a rating is coming, and rendering
                // enabled ones would let a second review be submitted.
                <button
                  type="button"
                  onClick={continueRetrain}
                  className="w-full px-4 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  {t.practice.continueAction}
                </button>
              ) : (
                <>
                  <RatingButtons
                    previewIntervals={currentItem.previewIntervals}
                    // Gated on the reveal, not just on the in-flight state.
                    // Previously only the KEYBOARD path checked isFlipped,
                    // so a mouse user could rate a card they had never
                    // turned over.
                    disabled={isSubmitting || !isFlipped}
                    onRate={handleRate}
                  />
                  <p className="text-center text-[10px] font-semibold text-slate-300 dark:text-slate-600">
                    {isFlipped ? '1 / 2 / 3 / 4' : t.practice.revealFirstHint}
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {!isLoading && error && !currentItem && !isEmpty && <ErrorState message={error} />}
      </div>
    </StudentLayout>
  );
};

export default ReviewSessionPage;
