import React, { useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';
import { isTtsSupported, speakText, cancelSpeech } from '../../../services/tts';
import { playCorrect, playIncorrect } from '../../../services/feedbackSounds';
import { isVersionConflict, ReviewRating } from '../../../services/learningService';
import {
  PersonalVocabWord,
  submitPersonalWordReview,
} from '../../../services/vocabPersonalService';
import CelebrationBurst from '../../shared/CelebrationBurst';
import RatingButtons from '../../practice/vocab/RatingButtons';
import { useVocabSession } from '../../practice/vocab/useVocabSession';
import { useReviewIntentKey } from '../../practice/reviewIntentKey';
import { SessionResult } from '../../practice/types';

interface PersonalFlashcardSessionProps {
  // Already filtered by the caller — MyVocabularyPage passes ALL words for
  // the "Thẻ ghi nhớ" tab and only due words for the sidebar's "Bắt đầu ôn
  // tập" button. This component itself has no opinion on which words it's
  // given (see the module comment in the approved plan).
  words: PersonalVocabWord[];
  onComplete: (result: SessionResult) => void;
  // Lets the caller keep its own word list / stats in sync after a rating,
  // without a full refetch — optional, since a standalone session (e.g. a
  // future dedicated review page) may not need it.
  onWordReviewed?: (wordId: string) => void;
}

// A new, dedicated component rather than a generic-adapter refactor of the
// existing FlashcardSession — see the approved plan's "Reuse strategy"
// section. Reuses every pure piece FlashcardSession does (useVocabSession,
// RatingButtons, CelebrationBurst, useReviewIntentKey, TTS helpers) but
// posts ratings to vocab-personal's own review endpoint. Substantially
// simpler than FlashcardSession itself: a PersonalVocabWord already carries
// its own meaning/example/audio inline (no per-card VocabWord detail fetch),
// and this queue has no previewIntervals endpoint (RatingButtons already
// supports a null preview — see its own doc comment).
const playWordAudio = (word: Pick<PersonalVocabWord, 'audioUrl' | 'text'>): (() => void) => {
  if (word.audioUrl) {
    const audio = new Audio(word.audioUrl);
    void audio.play().catch(() => {});
    return () => audio.pause();
  }
  speakText(word.text);
  return () => cancelSpeech();
};

const PersonalFlashcardSession: React.FC<PersonalFlashcardSessionProps> = ({
  words,
  onComplete,
  onWordReviewed,
}) => {
  const { t } = useTranslation();
  const { currentWord, index, total, correctCount, isComplete, answer } = useVocabSession(words);
  const [isFlipped, setIsFlipped] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { resolve: resolveClientReviewId, clear: clearReviewIntent } = useReviewIntentKey();

  useEffect(() => {
    if (isComplete) onComplete({ totalCards: total, correctCount });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  useEffect(() => {
    setIsFlipped(false);
    setSubmitError(null);
  }, [currentWord?.id]);

  // Same "every card that becomes current speaks itself" behaviour as
  // FlashcardSession — see its own comment for why this is still inside a
  // user-activated session despite not being a direct click.
  useEffect(() => {
    if (!currentWord) return;
    return playWordAudio(currentWord);
  }, [currentWord?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
      e.preventDefault();
      setIsFlipped((prev) => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!currentWord) return null;

  const handleRate = async (rating: ReviewRating) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await submitPersonalWordReview(currentWord.id, {
        rating,
        clientReviewId: resolveClientReviewId(currentWord.id, rating),
      });
      clearReviewIntent();
      onWordReviewed?.(currentWord.id);
      const correct = rating !== 'AGAIN';
      if (correct) {
        playCorrect();
        setBurstKey((k) => k + 1);
      } else {
        playIncorrect();
      }
      answer(correct);
    } catch (error) {
      // A version conflict means another request touched this word's
      // progress underneath us — no preview to refresh here (unlike
      // FlashcardSession), so simply let the student try the rating again.
      if (!isVersionConflict(error)) {
        setSubmitError(t.myVocab.saveFailed);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePlayAudio = () => playWordAudio(currentWord);

  return (
    <div className="space-y-5">
      <p className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 text-center">
        {Math.min(index + 1, total)}/{total}
      </p>

      <div className="practice-flip-card relative h-80 sm:h-96 max-w-md mx-auto">
        <CelebrationBurst burstKey={burstKey} />
        <div className={`practice-flip-card-inner ${isFlipped ? 'practice-flip-card-flipped' : ''}`}>
          <button
            type="button"
            onClick={() => setIsFlipped(true)}
            aria-label={t.practice.flipCardHint}
            aria-hidden={isFlipped}
            tabIndex={isFlipped ? -1 : 0}
            className="practice-flip-card-face w-full h-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col items-center justify-center gap-3 p-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
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
                className="p-2.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors cursor-pointer"
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
            className="practice-flip-card-face practice-flip-card-face-back w-full h-full bg-white dark:bg-slate-900 border-2 border-blue-100 dark:border-blue-500/30 rounded-3xl shadow-sm flex flex-col gap-3 p-5 sm:p-6 overflow-y-auto text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
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
            </div>

            <div>
              <p className="text-lg sm:text-xl font-extrabold text-amber-600 dark:text-amber-400">
                {currentWord.meaningVi}
              </p>
              {currentWord.meaningEn && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{currentWord.meaningEn}</p>
              )}
            </div>

            {currentWord.exampleSentence && (
              <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 rounded-2xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500 dark:text-blue-400 mb-1.5">
                  {t.practice.exampleLabel}
                </p>
                <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  &ldquo;{currentWord.exampleSentence}&rdquo;
                </p>
                {currentWord.exampleTranslation && (
                  <p className="text-xs italic text-slate-400 dark:text-slate-500 mt-1.5">
                    &rarr; {currentWord.exampleTranslation}
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
        <RatingButtons previewIntervals={null} disabled={isSubmitting} onRate={handleRate} />
      </div>
    </div>
  );
};

export default PersonalFlashcardSession;
