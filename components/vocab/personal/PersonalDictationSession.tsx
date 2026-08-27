import React, { useEffect, useRef, useState } from 'react';
import { Volume2, Pause, CheckCircle2, XCircle } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';
import { isTtsSupported, speakText } from '../../../services/tts';
import { playCorrect, playIncorrect } from '../../../services/feedbackSounds';
import { isVersionConflict, ReviewRating } from '../../../services/learningService';
import {
  PersonalVocabWord,
  submitPersonalWordReview,
} from '../../../services/vocabPersonalService';
import CelebrationBurst from '../../shared/CelebrationBurst';
import RatingButtons from '../../practice/vocab/RatingButtons';
import { useAudioPlayback, formatAudioTime } from '../../practice/useAudioPlayback';
import { useVocabSession } from '../../practice/vocab/useVocabSession';
import { useReviewIntentKey } from '../../practice/reviewIntentKey';
import { SessionResult } from '../../practice/types';

interface PersonalDictationSessionProps {
  words: PersonalVocabWord[];
  onComplete: (result: SessionResult) => void;
  onWordReviewed?: (wordId: string) => void;
}

const normalize = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9'\s-]/g, '');

// Same shortcut map as DictationSession.tsx's RATING_KEYS — re-declared
// rather than shared, matching that file's own precedent.
const RATING_KEYS: Record<string, ReviewRating> = { '1': 'AGAIN', '2': 'HARD', '3': 'GOOD', '4': 'EASY' };

// A new, dedicated component mirroring DictationSession.tsx's flow (real
// audio-or-TTS playback, typed-answer check, suggested-then-explicit
// rating) but posting to vocab-personal's own review endpoint — see the
// approved plan's "Reuse strategy" section for why this is a new component
// rather than a shared-adapter refactor of DictationSession.
const PersonalDictationSession: React.FC<PersonalDictationSessionProps> = ({
  words,
  onComplete,
  onWordReviewed,
}) => {
  const { t } = useTranslation();
  const { currentWord, index, total, correctCount, isComplete, answer } = useVocabSession(words);
  const [typedText, setTypedText] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [burstKey, setBurstKey] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { resolve: resolveClientReviewId, clear: clearReviewIntent } = useReviewIntentKey();
  const inputRef = useRef<HTMLInputElement>(null);
  const handleRateRef = useRef<(rating: ReviewRating) => void>(() => {});

  const audio = useAudioPlayback(currentWord?.audioUrl ?? null);

  useEffect(() => {
    if (isComplete) onComplete({ totalCards: total, correctCount });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  useEffect(() => {
    setTypedText('');
    setFeedback(null);
    setIsSpeaking(false);
    setSubmitError(null);
  }, [currentWord?.id]);

  useEffect(() => {
    if (!feedback) inputRef.current?.focus();
  }, [feedback]);

  useEffect(() => {
    if (!currentWord) return;
    if (currentWord.audioUrl) {
      audio.play();
    } else {
      speakText(currentWord.text, {
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWord?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!feedback || isSubmitting) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        handleRateRef.current(feedback === 'correct' ? 'GOOD' : 'AGAIN');
        return;
      }
      const rating = RATING_KEYS[e.key];
      if (rating) {
        e.preventDefault();
        handleRateRef.current(rating);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [feedback, isSubmitting]);

  if (!currentWord) return null;

  const usesTts = !currentWord.audioUrl;
  const hasAudioSource = Boolean(currentWord.audioUrl) || isTtsSupported();
  const answeredCount = Math.min(index, total);
  const progressPercent = total > 0 ? Math.round((answeredCount / total) * 100) : 0;
  const suggestedRating: ReviewRating | undefined = feedback ? (feedback === 'correct' ? 'GOOD' : 'AGAIN') : undefined;

  const handlePlay = () => {
    if (currentWord.audioUrl) {
      audio.toggle();
    } else {
      speakText(currentWord.text, {
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (feedback) return;
    const isCorrect = normalize(typedText) === normalize(currentWord.text);
    setFeedback(isCorrect ? 'correct' : 'incorrect');
    if (isCorrect) {
      playCorrect();
      setBurstKey((k) => k + 1);
    } else {
      playIncorrect();
    }
  };

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
      answer(rating !== 'AGAIN');
    } catch (error) {
      if (!isVersionConflict(error)) {
        setSubmitError(t.myVocab.saveFailed);
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  handleRateRef.current = handleRate;

  const audioProgressPercent =
    audio.duration > 0 ? Math.min(100, (audio.currentTime / audio.duration) * 100) : 0;

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-bold text-slate-400 dark:text-slate-500">
          <span>
            {t.practice.questionLabel} {Math.min(index + 1, total)}/{total}
          </span>
          <span>
            {t.practice.correctLabel}: {correctCount}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={t.practice.sessionProgress}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={answeredCount}
          className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
        >
          <div
            style={{ width: `${progressPercent}%` }}
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
          />
        </div>
      </div>

      <div className="relative bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm p-8 text-center space-y-5">
        <CelebrationBurst burstKey={burstKey} />

        {hasAudioSource ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={handlePlay}
              aria-label={t.practice.playAudio}
              className="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-gradient-to-tr from-blue-500 to-indigo-500 text-white shadow-lg hover:scale-105 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              {audio.isPlaying ? <Pause size={26} aria-hidden="true" /> : <Volume2 size={26} aria-hidden="true" />}
            </button>

            {!usesTts && audio.duration > 0 && (
              <div className="space-y-1">
                <div
                  role="progressbar"
                  aria-label={t.practice.playbackProgress}
                  aria-valuemin={0}
                  aria-valuemax={Math.round(audio.duration)}
                  aria-valuenow={Math.round(audio.currentTime)}
                  className="w-40 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mx-auto"
                >
                  <div style={{ width: `${audioProgressPercent}%` }} className="h-full bg-blue-500 rounded-full" />
                </div>
                <p className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500">
                  {formatAudioTime(audio.currentTime)} / {formatAudioTime(audio.duration)}
                </p>
              </div>
            )}

            {usesTts && isSpeaking && (
              <div className="flex items-end justify-center gap-1 h-5" aria-label={t.practice.speaking}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className="practice-speaking-bar w-1 h-4 bg-blue-400 rounded-full"
                    style={{ animationDelay: `${i * 0.12}s` }}
                    aria-hidden="true"
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">{t.practice.ttsNotSupported}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            ref={inputRef}
            type="text"
            value={typedText}
            onChange={(e) => setTypedText(e.target.value)}
            disabled={Boolean(feedback)}
            placeholder={t.practice.typeWhatYouHear}
            aria-label={t.practice.typeWhatYouHear}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-center text-lg font-bold text-slate-900 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 disabled:opacity-70"
          />

          {feedback && (
            <div
              role="status"
              aria-live="polite"
              className={`flex items-center justify-center gap-2 text-sm font-bold ${
                feedback === 'correct' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {feedback === 'correct' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
              <span>{feedback === 'correct' ? t.practice.correct : `${t.practice.incorrect}: ${currentWord.text}`}</span>
            </div>
          )}

          {feedback && (
            <div className="practice-fade-in text-left bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <span className="font-bold">{t.practice.yourAnswerLabel}:</span> {typedText.trim() || '—'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <span className="font-bold">{t.practice.correctWordLabel}:</span> {currentWord.text}
              </p>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500 dark:text-blue-400 mb-1">
                  {t.practice.meaningLabel}
                </p>
                <p className="text-sm font-extrabold text-amber-600 dark:text-amber-400">{currentWord.meaningVi}</p>
                {currentWord.meaningEn && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{currentWord.meaningEn}</p>
                )}
              </div>
            </div>
          )}

          {!feedback && (
            <button
              type="submit"
              className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              {t.practice.checkAnswer}
            </button>
          )}

          {feedback && (
            <div className="practice-fade-in space-y-2">
              {submitError && (
                <p role="alert" className="text-xs font-semibold text-rose-500 text-center">
                  {submitError}
                </p>
              )}
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 text-center">
                {t.practice.suggestedRatingHint}
              </p>
              <RatingButtons previewIntervals={null} suggested={suggestedRating} disabled={isSubmitting} onRate={handleRate} />
              <p className="text-center text-[10px] font-semibold text-slate-300 dark:text-slate-600">
                {t.practice.ratingKeyboardHint}
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default PersonalDictationSession;
