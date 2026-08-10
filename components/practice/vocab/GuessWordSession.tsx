import React, { useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, Eye, Lightbulb, XCircle } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';
import { VocabWordExample, VocabWordListItem } from '../../../types';
import { getWord } from '../../../services/vocabWordService';
import { speakText, cancelSpeech } from '../../../services/tts';
import { playCorrect, playIncorrect } from '../../../services/feedbackSounds';
import CelebrationBurst from '../../shared/CelebrationBurst';
import Skeleton from '../../shared/Skeleton';
import ErrorState from '../../shared/ErrorState';
import { blankSentence } from './wordBlanking';
import { pickHintPositions, buildHintMask } from './hintMask';
import { useGuessWordQueue } from './useGuessWordQueue';
import GuessWordSessionSummary from './GuessWordSessionSummary';

interface GuessWordSessionProps {
  deckId: string;
  words: VocabWordListItem[];
  onExit: () => void;
}

// The prompt is VI -> EN: the headline shows the word's Vietnamese meaning
// OPENLY (meanings[0], never masked — it's the given clue, not the answer),
// alongside its part of speech and picture when the word has one. The
// English word itself (currentWord.text) is what's hidden, guessed from
// that Vietnamese meaning, the English gloss (meanings[1]) and a blanked
// example — shown as a star mask (see hintMask.ts) above the input, not
// the headline.
//
// Hints are 3 deterministic levels, never randomized per render:
//  - Level 0 (default, no hint spent): the mask already shows the exact
//    target length/shape (spaces, hyphens, apostrophes preserved) — a
//    deliberate reversal of this mode's original "don't leak length"
//    design, per product direction: the shape alone isn't the answer.
//  - Level 1: one additional letter revealed (always the first).
//  - Level 2: one more deterministic letter (pickHintPositions.ts) — never
//    more letters after this; level 3 adds no letters at all.
//  - Level 3: plays pronunciation audio (real audioUrl preferred, TTS
//    fallback), only on this explicit click — never autoplayed. Repeated
//    clicks once at level 3 replay the audio rather than doing nothing.
// Taking any number of hints never affects scoring — session-score-only,
// same posture as GamesSession.

// Prefers the word's real audio over TTS — the same pattern
// FlashcardSession.tsx/ReviewSessionPage.tsx already use, duplicated here
// rather than extracted: those two files are shipped and tested
// independently of this hint feature.
const playWordAudio = (word: Pick<VocabWordListItem, 'audioUrl' | 'text'>): (() => void) => {
  if (word.audioUrl) {
    const audio = new Audio(word.audioUrl);
    void audio.play().catch(() => {});
    return () => audio.pause();
  }
  speakText(word.text);
  return () => cancelSpeech();
};

// Duplicated verbatim from DictationSession.tsx — a 3-line pure function,
// not worth extracting for this.
const normalize = (value: string): string => value.trim().toLowerCase().replace(/[^a-z0-9'\s-]/g, '');

const GuessWordSession: React.FC<GuessWordSessionProps> = ({ deckId, words, onExit }) => {
  const { t } = useTranslation();
  const {
    currentWord,
    totalWords,
    remainingCount,
    learnedThisSessionCount,
    struggledCount,
    isLoading,
    error,
    isComplete,
    answerCorrect,
    answerWrongOrSkip,
    restartStruggled,
    restartFull,
    retry,
  } = useGuessWordQueue(deckId, words);
  const [example, setExample] = useState<VocabWordExample | null>(null);
  const [typedText, setTypedText] = useState('');
  // 'correct'/'gaveup' are the two FINAL, locked outcomes — the round ends,
  // the real word is revealed, Continue appears. A wrong Check is deliberately
  // NOT one of these: it's transient (wrongAttempt below), never locks the
  // round or reveals the answer, so the two "you got it wrong" paths stay
  // distinct rather than colliding into one shared "incorrect" state.
  const [feedback, setFeedback] = useState<'correct' | 'gaveup' | null>(null);
  const [wrongAttempt, setWrongAttempt] = useState(false);
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2 | 3>(0);
  const [burstKey, setBurstKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Holds the teardown for whatever hint-3 audio is currently playing
  // (audio.pause or cancelSpeech) — stopped on card change/unmount so a
  // late-arriving pronunciation never bleeds into the next card.
  const stopAudioRef = useRef<(() => void) | null>(null);

  // Same lazy per-card fetch FlashcardSession already uses — examples live
  // only on the student word-detail endpoint, not the deck word-list shape.
  useEffect(() => {
    setTypedText('');
    setFeedback(null);
    setWrongAttempt(false);
    setHintLevel(0);
    setExample(null);
    stopAudioRef.current?.();
    stopAudioRef.current = null;
    inputRef.current?.focus();
    if (!currentWord) return;
    let ignore = false;
    getWord(currentWord.id)
      .then((detail) => {
        if (!ignore) setExample(detail.examples[0] ?? null);
      })
      .catch(() => {
        // Supplementary content only — a failed fetch just means no example
        // section renders.
      });
    return () => {
      ignore = true;
      stopAudioRef.current?.();
    };
  }, [currentWord?.id]);

  // Once the round locks (correct or gave up), re-focus the input — it goes
  // read-only rather than disabled specifically so it can keep focus and
  // keep participating in the form, letting a plain Enter press advance via
  // handleSubmit's Continue branch above. Checking via mouse click moves
  // focus onto the (then-unmounted) Check button first, which would
  // otherwise strand focus on <body> once that button disappears.
  useEffect(() => {
    if (feedback) inputRef.current?.focus();
  }, [feedback]);

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto">
        <ErrorState message={error} onRetry={retry} />
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="max-w-md mx-auto">
        <GuessWordSessionSummary
          totalWords={totalWords}
          learnedThisSessionCount={learnedThisSessionCount}
          struggledCount={struggledCount}
          onReviewStruggled={restartStruggled}
          onRestartFull={restartFull}
          onExit={onExit}
        />
      </div>
    );
  }

  if (!currentWord) return null;

  const primaryPartOfSpeech = currentWord.meanings[0]?.partOfSpeech ?? null;
  const englishGloss = currentWord.meanings[1]?.meaning ?? null;
  const vietnameseMeaning = currentWord.meanings[0]?.meaning ?? null;
  // blankSentence returns null when the fetched example's sentence doesn't
  // literally contain the word (e.g. an inflected form) — the section is
  // omitted entirely rather than falling back to the raw, answer-leaking
  // sentence.
  const blankedExample = example ? blankSentence(example.sentence, currentWord.text) : null;

  // Deterministic per word — recomputed from currentWord.text each render,
  // never stored/randomized. Level 2 and level 3 reveal the same two
  // letters; level 3 adds audio, never a third letter.
  const { level1: hintIndex1, level2: hintIndex2 } = pickHintPositions(currentWord.text);
  const revealedIndices = new Set<number>();
  if (hintLevel >= 1) revealedIndices.add(hintIndex1);
  if (hintLevel >= 2) revealedIndices.add(hintIndex2);
  const displayWord = feedback ? currentWord.text : buildHintMask(currentWord.text, revealedIndices);
  const wordIsHidden = !feedback;
  // Persisted progress, not position in a shuffled order: `learnedCount`
  // already includes words learned in EARLIER sessions (excluded from the
  // queue on load), matching the product owner's literal "2/50 đã học" spec.
  const learnedCount = totalWords - remainingCount;
  const progressPercent = totalWords > 0 ? Math.round((learnedCount / totalWords) * 100) : 0;

  const handleHint = () => {
    if (feedback) return;
    const nextLevel = Math.min(hintLevel + 1, 3) as 0 | 1 | 2 | 3;
    setHintLevel(nextLevel);
    if (nextLevel === 3) {
      // Fires on first reaching level 3 AND on every subsequent click while
      // already there — Math.min keeps recomputing 3, so "click again"
      // naturally replays rather than needing a separate branch.
      stopAudioRef.current?.();
      stopAudioRef.current = playWordAudio(currentWord);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Once the round is locked (correct, or gave up), Enter in the input is
    // repurposed as the Continue shortcut — see the effect below that keeps
    // focus on the input for exactly this.
    if (feedback) {
      handleContinue();
      return;
    }
    const isCorrect = normalize(typedText) === normalize(currentWord.text);
    if (isCorrect) {
      setFeedback('correct');
      playCorrect();
      setBurstKey((k) => k + 1);
      // Confirmed correctness is exactly when the word's pronunciation
      // should be heard — same audio source (real audioUrl, TTS fallback)
      // as the level-3 hint, stopped first in case that hint audio is
      // still playing.
      stopAudioRef.current?.();
      stopAudioRef.current = playWordAudio(currentWord);
    } else {
      // Deliberately NOT a final state: no reveal, no lock — the round stays
      // open so the learner can retry. Revealing the answer is Skip's job
      // alone; duplicating that here would make the two actions redundant.
      setWrongAttempt(true);
      playIncorrect();
    }
  };

  const handleDontKnow = () => {
    if (feedback) return;
    // Giving up always counts as incorrect, regardless of whatever was
    // typed so far, and — unlike a wrong Check — DOES lock the round and
    // reveal the real word.
    setFeedback('gaveup');
    setWrongAttempt(false);
    playIncorrect();
    // Skipping reveals the word, so it should be heard too — same source
    // and stop-first discipline as the correct-answer path above.
    stopAudioRef.current?.();
    stopAudioRef.current = playWordAudio(currentWord);
  };

  const handleContinue = () => {
    if (!feedback) return;
    // Reset the round's UI state explicitly here, rather than relying only
    // on the currentWord?.id-keyed effect above — a requeued word on a
    // small (or single-word) deck can land back at the SAME queue position,
    // meaning currentWord's identity never changes and that effect would
    // never re-fire, leaving a stale locked "Not quite: ..." screen forever.
    const wasCorrect = feedback === 'correct';
    setTypedText('');
    setFeedback(null);
    setWrongAttempt(false);
    setHintLevel(0);
    // Taking a hint never affects whether this counts as "learned" — a
    // correct answer after a hint still marks the word learned. Only a
    // confirmed-correct answer persists anything (see
    // vocabGuessProgressService); giving up requeues the word locally with
    // no backend call, same as a wrong Check.
    if (wasCorrect) {
      answerCorrect(currentWord.id);
    } else {
      answerWrongOrSkip(currentWord.id);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-bold text-slate-400 dark:text-slate-500">
          <span>{t.practice.guessLearnedOfTotal(learnedCount, totalWords)}</span>
          <span>
            {t.practice.reviewRemainingLabel}: {remainingCount}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={t.practice.sessionProgress}
          aria-valuemin={0}
          aria-valuemax={totalWords}
          aria-valuenow={learnedCount}
          className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
        >
          <div
            style={{ width: `${progressPercent}%` }}
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
          />
        </div>
      </div>

      <div className="relative bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm p-6 sm:p-8 text-center space-y-4">
        <CelebrationBurst burstKey={burstKey} />

        {currentWord.imageUrl && (
          <img
            src={currentWord.imageUrl}
            alt=""
            aria-hidden="true"
            className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-2xl mx-auto border border-slate-100 dark:border-slate-800 shadow-sm"
          />
        )}

        {/* The Vietnamese meaning is the GIVEN clue for this VI -> EN mode —
            shown openly, never masked. The English word being guessed only
            ever appears in the masked pill below, never here. */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <p className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400">
            {vietnameseMeaning || t.common.noDataYet}
          </p>
          {primaryPartOfSpeech && (
            <span className="inline-block text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
              {primaryPartOfSpeech.toLowerCase()}
            </span>
          )}
        </div>

        {englishGloss && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
              {t.practice.englishDefinitionLabel}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300">{englishGloss}</p>
          </div>
        )}

        {blankedExample && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500 dark:text-blue-400 mb-1">
              {t.practice.exampleLabel}
            </p>
            <p className="text-sm sm:text-base font-semibold italic text-slate-800 dark:text-slate-100">{blankedExample}</p>
            {example?.translation && (
              <p className="text-xs italic text-slate-400 dark:text-slate-500 mt-1">{example.translation}</p>
            )}
          </div>
        )}

        <div className="flex items-center justify-center gap-3">
          <span
            aria-label={wordIsHidden ? t.practice.hiddenWordAriaLabel : undefined}
            className={`inline-block px-4 py-2 rounded-xl font-mono font-bold tracking-widest text-sm sm:text-base ${
              feedback
                ? 'border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100'
                : 'border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500'
            }`}
          >
            {displayWord}
          </span>
          <button
            type="button"
            onClick={handleHint}
            disabled={Boolean(feedback)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <Lightbulb size={14} />
            {hintLevel > 0 ? t.practice.hintProgressLabel(hintLevel) : t.practice.hintAction}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            ref={inputRef}
            type="text"
            value={typedText}
            onChange={(e) => {
              setTypedText(e.target.value);
              if (wrongAttempt) setWrongAttempt(false);
            }}
            // readOnly, not disabled: once the round locks it must stay
            // focusable/part of the form so Enter still submits (see the
            // refocus effect above) — a disabled input can do neither.
            readOnly={Boolean(feedback)}
            placeholder={t.practice.wordInputPlaceholder}
            aria-label={t.practice.wordInputPlaceholder}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-center text-lg font-bold text-slate-900 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 ${feedback ? 'opacity-70' : ''}`}
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
            </div>
          )}

          {!feedback && (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleDontKnow}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                <Eye size={16} />
                {t.practice.dontKnowAction}
              </button>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <Check size={16} />
                {t.practice.checkWordAction}
              </button>
            </div>
          )}

          {!feedback && wrongAttempt && (
            <div
              role="status"
              aria-live="polite"
              className="practice-fade-in flex items-center justify-center gap-2 py-2.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wide"
            >
              <XCircle size={16} />
              {t.practice.incorrectTryAgain}
            </div>
          )}

          {feedback && (
            <button
              type="button"
              onClick={handleContinue}
              className="practice-fade-in w-full py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              {t.practice.continueAction}
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default GuessWordSession;
