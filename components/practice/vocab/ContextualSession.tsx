import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PenLine } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';
import { VocabWordExample, VocabWordListItem } from '../../../types';
import { getWord } from '../../../services/vocabWordService';
import { playCorrect, playIncorrect } from '../../../services/feedbackSounds';
import { shuffleArray } from '../shuffle';
import Skeleton from '../../shared/Skeleton';
import EmptyState from '../../shared/EmptyState';
import CelebrationBurst from '../../shared/CelebrationBurst';
import { blankSentence, pickUsableExample } from './wordBlanking';
import { mapWithConcurrency } from './concurrency';
import { useVocabSession } from './useVocabSession';
import { SessionResult } from '../types';

interface ContextualSessionProps {
  words: VocabWordListItem[];
  onComplete: (result: SessionResult) => void;
}

// A word only powers this mode if it has BOTH a literal example to blank AND
// at least one real (case/whitespace-distinct) alternative elsewhere in the
// deck to offer as a wrong answer — otherwise it isn't a quiz question. Both
// conditions are resolved once, up front, before the round can start, so
// `total` is always honest rather than counting cards the student never saw.

/** Cheap, case/whitespace-insensitive equality for comparing word TEXT
 * (unlike GamesSession's SpeedRound, which dedupes word MEANINGS via a bare
 * `Set` — safe there because meanings rarely collide by case; word text is a
 * real collision risk, e.g. "Apple" vs "apple"). */
const normalizeWord = (text: string): string => text.trim().toLowerCase();

const hasUsableDistractor = (word: VocabWordListItem, allWords: VocabWordListItem[]): boolean => {
  const normalizedTarget = normalizeWord(word.text);
  return allWords.some((w) => w.id !== word.id && normalizeWord(w.text) !== normalizedTarget);
};

/** Correct answer + up to 3 distractors, normalized-deduped (keeping each
 * option's original casing for display) and drawn from the FULL deck — a
 * bigger pool than just the eligible subset, since a distractor's raw text
 * needs no example to be usable. */
const buildOptions = (currentWord: VocabWordListItem, allWords: VocabWordListItem[]): string[] => {
  const correctAnswer = currentWord.text;
  const normalizedCorrect = normalizeWord(correctAnswer);
  const distractorsByNormalized = new Map<string, string>();
  for (const w of allWords) {
    if (w.id === currentWord.id) continue;
    const normalized = normalizeWord(w.text);
    if (normalized === normalizedCorrect) continue;
    if (!distractorsByNormalized.has(normalized)) distractorsByNormalized.set(normalized, w.text);
  }
  const distractors = shuffleArray(Array.from(distractorsByNormalized.values())).slice(0, 3);
  return shuffleArray([correctAnswer, ...distractors]);
};

const WORD_DETAIL_FETCH_CONCURRENCY = 6;
const ANSWER_REVEAL_MS = 1000; // duplicated from GamesSession.tsx — not exported there

interface EligibleEntry {
  word: VocabWordListItem;
  example: VocabWordExample;
}

const ContextualSession: React.FC<ContextualSessionProps> = ({ words, onComplete }) => {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<'loading' | 'ready' | 'empty'>('loading');
  const [eligible, setEligible] = useState<EligibleEntry[]>([]);

  // Mount-scoped: `words` is stable for the lifetime of a mounted instance —
  // every mode switch/restart already forces a full remount via
  // `key={sessionKey}` in VocabPracticeSessionPage.
  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    mapWithConcurrency(words, WORD_DETAIL_FETCH_CONCURRENCY, async (word): Promise<EligibleEntry | null> => {
      try {
        const detail = await getWord(word.id);
        const example = pickUsableExample(detail.examples, word.text);
        return example ? { word, example } : null;
      } catch {
        return null;
      }
    }).then((results) => {
      if (cancelled) return;
      const next = results.filter(
        (entry): entry is EligibleEntry => entry !== null && hasUsableDistractor(entry.word, words),
      );
      setEligible(next);
      setPhase(next.length > 0 ? 'ready' : 'empty');
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exampleByWordId = useMemo(() => new Map(eligible.map((e) => [e.word.id, e.example])), [eligible]);

  if (phase === 'loading') {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (phase === 'empty') {
    return <EmptyState icon={<PenLine size={32} />} message={t.practice.contextualNoEligibleWords} />;
  }

  return (
    <ContextualRound
      eligibleWords={eligible.map((e) => e.word)}
      exampleByWordId={exampleByWordId}
      allWords={words}
      onComplete={onComplete}
    />
  );
};

interface ContextualRoundProps {
  eligibleWords: VocabWordListItem[];
  exampleByWordId: Map<string, VocabWordExample>;
  allWords: VocabWordListItem[];
  onComplete: (result: SessionResult) => void;
}

const ContextualRound: React.FC<ContextualRoundProps> = ({
  eligibleWords,
  exampleByWordId,
  allWords,
  onComplete,
}) => {
  const { t } = useTranslation();
  const { currentWord, index, total, correctCount, isComplete, answer } = useVocabSession(eligibleWords);
  const [options, setOptions] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [burstKey, setBurstKey] = useState(0);

  // Same timer-hygiene pattern as GamesSession's SpeedRound — cleared on
  // unmount and on every question change, so a mode switch can never fire a
  // stale advance.
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceFiredRef = useRef(false);

  const clearAdvanceTimer = () => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = null;
  };

  useEffect(() => clearAdvanceTimer, []);

  useEffect(() => {
    if (isComplete) onComplete({ totalCards: total, correctCount });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  useEffect(() => {
    if (!currentWord) return;
    clearAdvanceTimer();
    advanceFiredRef.current = false;
    setSelected(null);
    setOptions(buildOptions(currentWord, allWords));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWord?.id]);

  if (!currentWord) return null;

  // Guaranteed present by construction — `eligibleWords` only ever contains
  // words that passed the outer component's `pickUsableExample` filter.
  const example = exampleByWordId.get(currentWord.id);
  if (!example) return null;

  const correctAnswer = currentWord.text;
  const locked = selected !== null;
  const answeredCount = Math.min(index, total);
  const progressPercent = total > 0 ? Math.round((answeredCount / total) * 100) : 0;
  const blankedSentence = blankSentence(example.sentence, currentWord.text);

  const handleSelect = (option: string) => {
    if (locked) return;
    setSelected(option);
    const isCorrect = option === correctAnswer;
    if (isCorrect) {
      playCorrect();
      setBurstKey((k) => k + 1);
    } else {
      playIncorrect();
    }
    advanceTimerRef.current = setTimeout(() => {
      if (advanceFiredRef.current) return;
      advanceFiredRef.current = true;
      answer(isCorrect);
    }, ANSWER_REVEAL_MS);
  };

  return (
    <div className="relative max-w-md mx-auto space-y-4">
      <CelebrationBurst burstKey={burstKey} />
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

      <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm p-6 text-center space-y-1.5">
        <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">{blankedSentence}</p>
        {example.translation && (
          <p className="text-xs italic text-slate-400 dark:text-slate-500">&rarr; {example.translation}</p>
        )}
      </div>

      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{t.practice.contextualChooseHint}</p>

      <div className="grid grid-cols-1 gap-2.5">
        {options.map((option, i) => {
          const letter = String.fromCharCode(65 + i);
          const isSelected = selected === option;
          const isCorrectOption = option === correctAnswer;
          return (
            <button
              key={option}
              type="button"
              onClick={() => handleSelect(option)}
              disabled={locked}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold text-left border-2 transition-colors ${
                locked && isCorrectOption
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500 text-emerald-700 dark:text-emerald-300'
                  : locked && isSelected
                    ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500 text-rose-700 dark:text-rose-300'
                    : locked
                      ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-500'
              }`}
            >
              <span
                aria-hidden="true"
                className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/70 dark:bg-black/20 text-[10px] font-bold"
              >
                {letter}
              </span>
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ContextualSession;
