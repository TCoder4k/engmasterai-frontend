import React, { useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';
import { VocabWordListItem, VocabWordExample } from '../../../types';
import { isTtsSupported, speakText } from '../../../services/tts';
import { getWord } from '../../../services/vocabWordService';
import { playCorrect, playIncorrect } from '../../../services/feedbackSounds';
import {
  getWordProgress,
  submitReview,
  isVersionConflict,
  PreviewIntervals,
  ReviewRating,
} from '../../../services/learningService';
import CelebrationBurst from '../CelebrationBurst';
import RatingButtons from './RatingButtons';
import { useVocabSession } from './useVocabSession';
import { useReviewIntentKey } from '../reviewIntentKey';
import { SessionResult } from '../types';

interface FlashcardSessionProps {
  words: VocabWordListItem[];
  onComplete: (result: SessionResult) => void;
}

// Highlights the target word/phrase where it literally occurs in the real
// example sentence. Falls back to the plain sentence when it doesn't occur
// verbatim (e.g. an inflected form) rather than guessing at a match.
const renderHighlightedSentence = (sentence: string, word: string): React.ReactNode => {
  const matchIndex = sentence.toLowerCase().indexOf(word.toLowerCase());
  if (matchIndex === -1) return sentence;

  const before = sentence.slice(0, matchIndex);
  const match = sentence.slice(matchIndex, matchIndex + word.length);
  const after = sentence.slice(matchIndex + word.length);

  return (
    <>
      {before}
      <span className="text-indigo-600 dark:text-indigo-400 underline decoration-2 underline-offset-2">
        {match}
      </span>
      {after}
    </>
  );
};

// Real per-user, per-word SRS ratings (Sprint 04) — Again/Hard/Good/Easy
// each submit a real POST /learning/words/:wordId/review; the session-local
// score/completion tracking below (useVocabSession) is unrelated bookkeeping
// for this practice run's own summary, not a second source of scheduling
// truth (the backend owns scheduling; this component never computes an
// interval itself — see RatingButtons, which only ever displays numbers the
// backend already computed).
const FlashcardSession: React.FC<FlashcardSessionProps> = ({ words, onComplete }) => {
  const { t } = useTranslation();
  const { currentWord, index, total, correctCount, isComplete, answer } = useVocabSession(words);
  const [isFlipped, setIsFlipped] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  // Real examples live only on the student word-detail endpoint, not the
  // deck word-list shape — fetched lazily per card so nothing is fabricated.
  const [example, setExample] = useState<VocabWordExample | null>(null);
  const [previewIntervals, setPreviewIntervals] = useState<PreviewIntervals | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { resolve: resolveClientReviewId, clear: clearReviewIntent } = useReviewIntentKey();

  useEffect(() => {
    if (isComplete) onComplete({ totalCards: total, correctCount });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  useEffect(() => {
    setIsFlipped(false);
    setExample(null);
    if (!currentWord) return;
    let ignore = false;
    getWord(currentWord.id)
      .then((detail) => {
        if (!ignore) setExample(detail.examples[0] ?? null);
      })
      .catch(() => {
        // Supplementary content only — a failed fetch just means no example
        // section renders, never a broken flip flow.
      });
    return () => {
      ignore = true;
    };
  }, [currentWord?.id]);

  // Preview intervals are outside the due queue on purpose (this is
  // whole-deck practice, not a due-only review session) — see
  // LearningService.getWordProgress's own comment on the backend.
  useEffect(() => {
    setPreviewIntervals(null);
    setSubmitError(null);
    if (!currentWord) return;
    let ignore = false;
    getWordProgress(currentWord.id)
      .then((res) => {
        if (!ignore) setPreviewIntervals(res.previewIntervals);
      })
      .catch(() => {
        // Preview is a nicety, not a requirement — rating still works
        // without it (RatingButtons renders the day-count badge only when
        // it's available).
      });
    return () => {
      ignore = true;
    };
  }, [currentWord?.id]);

  if (!currentWord) return null;

  const handleRate = async (rating: ReviewRating) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await submitReview(currentWord.id, {
        rating,
        practiceMode: 'FLASHCARD',
        // Stable per (word, rating) intent — a retry after a version
        // conflict or a timeout MUST reuse the key, or the backend's
        // idempotency guard cannot dedupe it. See reviewIntentKey.ts.
        clientReviewId: resolveClientReviewId(currentWord.id, rating),
      });
      clearReviewIntent();
      const correct = rating !== 'AGAIN';
      if (correct) {
        playCorrect();
        setBurstKey((k) => k + 1);
      } else {
        playIncorrect();
      }
      answer(correct);
    } catch (error) {
      if (isVersionConflict(error)) {
        // Another request changed this word's progress underneath us —
        // silently refetch the current state and let the user re-rate,
        // never a scary error for something that isn't the user's fault.
        try {
          const res = await getWordProgress(currentWord.id);
          setPreviewIntervals(res.previewIntervals);
        } catch {
          // Best-effort refresh only.
        }
      } else {
        setSubmitError(t.common.loadFailed);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Only ever fires from this explicit button click — never on mount or
  // card-change — per the locked TTS autoplay-restriction discipline.
  const handlePlayAudio = () => {
    if (currentWord.audioUrl) {
      new Audio(currentWord.audioUrl).play().catch(() => {});
    } else {
      speakText(currentWord.text);
    }
  };

  const primaryPartOfSpeech = currentWord.meanings[0]?.partOfSpeech ?? null;

  return (
    <div className="space-y-5">
      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 px-3 py-2 rounded-xl">
        {t.practice.ratingsSavedNotice}
      </p>

      <p className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 text-center">
        {Math.min(index + 1, total)}/{total}
      </p>

      <div className="practice-flip-card relative h-80 sm:h-96 max-w-md mx-auto">
        <CelebrationBurst burstKey={burstKey} />
        <div className={`practice-flip-card-inner ${isFlipped ? 'practice-flip-card-flipped' : ''}`}>
          {/* Exactly one face is exposed to keyboard/AT at a time — the
              hidden face gets aria-hidden + tabIndex -1 so front/back are
              never simultaneously readable even though both stay in the
              DOM for the 3D flip. */}
          <button
            type="button"
            onClick={() => setIsFlipped(true)}
            aria-label={t.practice.flipCardHint}
            aria-hidden={isFlipped}
            tabIndex={isFlipped ? -1 : 0}
            className="practice-flip-card-face w-full h-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col items-center justify-center gap-3 p-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            {currentWord.imageUrl && (
              <img
                src={currentWord.imageUrl}
                alt=""
                aria-hidden="true"
                className="w-28 h-28 sm:w-32 sm:h-32 object-cover rounded-2xl"
              />
            )}
            <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 text-center">
              {currentWord.text}
            </p>
            {currentWord.ipa && (
              <p className="text-sm font-mono text-slate-400 dark:text-slate-500">/{currentWord.ipa}/</p>
            )}

            {(currentWord.audioUrl || isTtsSupported()) && (
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

            {primaryPartOfSpeech && (
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                {primaryPartOfSpeech.toLowerCase()}
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
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-full">
                {t.practice.meaningAndExampleBadge}
              </span>
              {(currentWord.audioUrl || isTtsSupported()) && (
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
                  className="shrink-0 w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  <Volume2 size={16} aria-hidden="true" />
                </span>
              )}
            </div>

            <div className="flex items-center flex-wrap gap-2">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {currentWord.text}
              </span>
              {currentWord.ipa && (
                <span className="text-sm font-mono text-slate-400 dark:text-slate-500">/{currentWord.ipa}/</span>
              )}
              {primaryPartOfSpeech && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-500/30">
                  {primaryPartOfSpeech.toLowerCase()}
                </span>
              )}
            </div>

            {currentWord.meanings.length === 0 ? (
              <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">{t.common.noDataYet}</p>
            ) : (
              <div>
                <p className="text-lg sm:text-xl font-extrabold text-amber-600 dark:text-amber-400">
                  {currentWord.meanings[0].meaning}
                </p>
                {currentWord.meanings[1] && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    {currentWord.meanings[1].meaning}
                  </p>
                )}
                {currentWord.meanings.slice(2).map((meaning) => (
                  <p key={meaning.id} className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {meaning.meaning}
                  </p>
                ))}
              </div>
            )}

            {example && (
              <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 rounded-2xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mb-1.5">
                  {t.practice.exampleLabel}
                </p>
                <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  &ldquo;{renderHighlightedSentence(example.sentence, currentWord.text)}&rdquo;
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

      <div className="max-w-md mx-auto space-y-2">
        {submitError && (
          <p role="alert" className="text-xs font-semibold text-rose-500 text-center">
            {submitError}
          </p>
        )}
        <RatingButtons previewIntervals={previewIntervals} disabled={isSubmitting} onRate={handleRate} />
      </div>
    </div>
  );
};

export default FlashcardSession;
