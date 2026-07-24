import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Zap, Grid3x3, Clock } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';
import { VocabWordListItem } from '../../../types';
import { shuffleArray } from '../shuffle';
import { playCorrect, playIncorrect, playTimeout, playComplete } from '../../../services/feedbackSounds';
import CelebrationBurst from '../CelebrationBurst';
import { useVocabSession } from './useVocabSession';
import { SessionResult } from '../types';

interface GamesSessionProps {
  words: VocabWordListItem[];
  onComplete: (result: SessionResult) => void;
}

type GameMode = 'speed' | 'match';

const SPEED_ROUND_SECONDS = 8;
// Sprint 03E: after a timeout the correct answer stays revealed long enough
// to actually read before auto-advancing (spec: ~1200–1800ms).
const TIMEOUT_REVEAL_MS = 1500;
const ANSWER_REVEAL_MS = 1000;

const wordMeaning = (word: VocabWordListItem): string => word.meanings[0]?.meaning || word.text;

type SpeedPhase = { kind: 'answering' } | { kind: 'locked'; reason: 'answered' | 'timeout'; selected: string | null };

const SpeedRound: React.FC<{ words: VocabWordListItem[]; onComplete: (r: SessionResult) => void }> = ({
  words,
  onComplete,
}) => {
  const { t } = useTranslation();
  const { index, total, correctCount, isComplete, currentWord, answer } = useVocabSession(words);
  const [options, setOptions] = useState<string[]>([]);
  const [phase, setPhase] = useState<SpeedPhase>({ kind: 'answering' });
  const [secondsLeft, setSecondsLeft] = useState(SPEED_ROUND_SECONDS);
  const [burstKey, setBurstKey] = useState(0);

  // All pending timers live in refs and are cleared on unmount and on every
  // question change, so a mode switch/unmount can never fire a stale
  // advance ("no double advance", "clear timers on unmount/mode change").
  // Note: background tabs may throttle setTimeout — the countdown can
  // stretch in an inactive tab, which is acceptable (it never skips ahead).
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceFiredRef = useRef(false);

  const clearTimers = () => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    if (tickTimerRef.current) clearTimeout(tickTimerRef.current);
    advanceTimerRef.current = null;
    tickTimerRef.current = null;
  };

  useEffect(() => clearTimers, []);

  useEffect(() => {
    if (isComplete) onComplete({ totalCards: total, correctCount });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  useEffect(() => {
    if (!currentWord) return;
    clearTimers();
    advanceFiredRef.current = false;
    const correctAnswer = wordMeaning(currentWord);
    const distractorPool = words
      .filter((w) => w.id !== currentWord.id)
      .map(wordMeaning)
      .filter((meaning) => meaning !== correctAnswer);
    const distractors = shuffleArray(Array.from(new Set(distractorPool))).slice(0, 3);
    setOptions(shuffleArray([correctAnswer, ...distractors]));
    setPhase({ kind: 'answering' });
    setSecondsLeft(SPEED_ROUND_SECONDS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWord?.id]);

  const scheduleAdvance = (correct: boolean, delayMs: number) => {
    advanceTimerRef.current = setTimeout(() => {
      if (advanceFiredRef.current) return;
      advanceFiredRef.current = true;
      answer(correct);
    }, delayMs);
  };

  // Countdown tick — stops the moment the question locks.
  useEffect(() => {
    if (!currentWord || phase.kind === 'locked') return;
    if (secondsLeft <= 0) {
      // Timeout: lock, reveal the correct answer, timeout sound, no score
      // increment, auto-advance after the reveal window.
      setPhase({ kind: 'locked', reason: 'timeout', selected: null });
      playTimeout();
      scheduleAdvance(false, TIMEOUT_REVEAL_MS);
      return;
    }
    tickTimerRef.current = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => {
      if (tickTimerRef.current) clearTimeout(tickTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, phase.kind, currentWord?.id]);

  if (!currentWord) return null;

  const correctAnswer = wordMeaning(currentWord);

  const handleSelect = (option: string) => {
    if (phase.kind === 'locked') return;
    const isCorrect = option === correctAnswer;
    setPhase({ kind: 'locked', reason: 'answered', selected: option });
    if (isCorrect) {
      playCorrect();
      setBurstKey((k) => k + 1);
    } else {
      playIncorrect();
    }
    scheduleAdvance(isCorrect, ANSWER_REVEAL_MS);
  };

  const locked = phase.kind === 'locked';
  const timedOut = locked && phase.reason === 'timeout';
  const selected = locked ? phase.selected : null;

  return (
    <div className="relative max-w-md mx-auto space-y-4">
      <CelebrationBurst burstKey={burstKey} />
      <div className="flex items-center justify-between text-xs font-bold text-slate-400 dark:text-slate-500">
        <span>
          {t.practice.questionLabel} {Math.min(index + 1, total)}/{total}
        </span>
        <span className={secondsLeft <= 3 && !locked ? 'text-rose-500' : ''}>{Math.max(secondsLeft, 0)}s</span>
      </div>
      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          style={{ width: `${(Math.max(secondsLeft, 0) / SPEED_ROUND_SECONDS) * 100}%` }}
          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-1000 ease-linear"
        />
      </div>
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm p-6 text-center">
        <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{currentWord.text}</p>
      </div>

      {/* Status is announced in text, never color alone. */}
      <div role="status" aria-live="polite" className="min-h-[20px] text-center text-xs font-bold">
        {timedOut && (
          <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <Clock size={14} aria-hidden="true" />
            {t.practice.timeUp}
          </span>
        )}
        {locked && !timedOut && (
          <span
            className={
              selected === correctAnswer
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }
          >
            {selected === correctAnswer ? t.practice.correct : t.practice.incorrect}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {options.map((option) => {
          const isSelected = selected === option;
          const isCorrectOption = option === correctAnswer;
          return (
            <button
              key={option}
              type="button"
              onClick={() => handleSelect(option)}
              disabled={locked}
              className={`px-4 py-3 rounded-xl text-sm font-semibold text-left border-2 transition-colors ${
                locked && isCorrectOption
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500 text-emerald-700 dark:text-emerald-300'
                  : locked && isSelected
                    ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500 text-rose-700 dark:text-rose-300'
                    : locked
                      ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-500'
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
};

interface MatchTile {
  key: string;
  wordId: string;
  label: string;
}

const MATCH_FLASH_MS = 350;
const WRONG_FLASH_MS = 600;

const MatchingGame: React.FC<{ words: VocabWordListItem[]; onComplete: (r: SessionResult) => void }> = ({
  words,
  onComplete,
}) => {
  const { t } = useTranslation();

  // Dedupe by word text AND by meaning label before pairing — two words
  // sharing an identical meaning string (or duplicate word rows) would make
  // the game ambiguous (either tile "looks" right); dropping duplicates
  // keeps every pair uniquely solvable. Small/odd decks simply yield fewer
  // pairs (minimum 1).
  const pairWords = useMemo(() => {
    const seenTexts = new Set<string>();
    const seenMeanings = new Set<string>();
    const unique = words.filter((w) => {
      const text = w.text.toLowerCase();
      const meaning = wordMeaning(w).toLowerCase();
      if (seenTexts.has(text) || seenMeanings.has(meaning)) return false;
      seenTexts.add(text);
      seenMeanings.add(meaning);
      return true;
    });
    return shuffleArray(unique).slice(0, Math.min(unique.length, 6));
  }, [words]);

  const [wordTiles] = useState<MatchTile[]>(() =>
    shuffleArray(pairWords.map((w): MatchTile => ({ key: `word-${w.id}`, wordId: w.id, label: w.text }))),
  );
  const [meaningTiles] = useState<MatchTile[]>(() =>
    shuffleArray(pairWords.map((w): MatchTile => ({ key: `meaning-${w.id}`, wordId: w.id, label: wordMeaning(w) }))),
  );

  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  // A just-matched pair stays briefly highlighted before its tiles are
  // removed and the remaining tiles reflow.
  const [flashingMatchId, setFlashingMatchId] = useState<string | null>(null);
  const [selectedWord, setSelectedWord] = useState<MatchTile | null>(null);
  const [selectedMeaning, setSelectedMeaning] = useState<MatchTile | null>(null);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [burstKey, setBurstKey] = useState(0);
  const [firstTryCorrect, setFirstTryCorrect] = useState(0);
  const attemptedPairs = useRef<Set<string>>(new Set());
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completeFiredRef = useRef(false);

  useEffect(
    () => () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    // Completion fires only when every pair has actually been removed.
    if (pairWords.length > 0 && matchedIds.size === pairWords.length && !completeFiredRef.current) {
      completeFiredRef.current = true;
      playComplete();
      onComplete({ totalCards: pairWords.length, correctCount: firstTryCorrect });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedIds]);

  if (pairWords.length === 0) return null;

  // Comparison in progress (correct flash or wrong flash) — block further
  // input until it resolves so a third rapid click can't corrupt state.
  const isResolving = wrongFlash || flashingMatchId !== null;

  const evaluate = (wordTile: MatchTile, meaningTile: MatchTile) => {
    const pairKey = wordTile.wordId;
    if (wordTile.wordId === meaningTile.wordId) {
      playCorrect();
      setBurstKey((k) => k + 1);
      setAnnouncement(t.practice.matchCorrect);
      if (!attemptedPairs.current.has(pairKey)) setFirstTryCorrect((c) => c + 1);
      setFlashingMatchId(pairKey);
      flashTimerRef.current = setTimeout(() => {
        setFlashingMatchId(null);
        setSelectedWord(null);
        setSelectedMeaning(null);
        setMatchedIds((prev) => new Set(prev).add(pairKey));
      }, MATCH_FLASH_MS);
    } else {
      playIncorrect();
      setAnnouncement(t.practice.matchWrong);
      attemptedPairs.current.add(pairKey);
      setWrongFlash(true);
      flashTimerRef.current = setTimeout(() => {
        setWrongFlash(false);
        setSelectedWord(null);
        setSelectedMeaning(null);
      }, WRONG_FLASH_MS);
    }
  };

  const handleSelectWord = (tile: MatchTile) => {
    if (matchedIds.has(tile.wordId) || isResolving) return;
    // Clicking the already-selected tile deselects it.
    if (selectedWord?.key === tile.key) {
      setSelectedWord(null);
      return;
    }
    setSelectedWord(tile);
    if (selectedMeaning) evaluate(tile, selectedMeaning);
  };

  const handleSelectMeaning = (tile: MatchTile) => {
    if (matchedIds.has(tile.wordId) || isResolving) return;
    if (selectedMeaning?.key === tile.key) {
      setSelectedMeaning(null);
      return;
    }
    setSelectedMeaning(tile);
    if (selectedWord) evaluate(selectedWord, tile);
  };

  const tileClass = (tile: MatchTile, isSelected: boolean) => {
    const isFlashing = flashingMatchId === tile.wordId;
    if (isFlashing)
      return 'w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-left border-2 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-400 dark:border-emerald-500 text-emerald-700 dark:text-emerald-300';
    if (isSelected && wrongFlash)
      return 'w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-left border-2 bg-rose-50 dark:bg-rose-500/10 border-rose-400 text-rose-600 dark:text-rose-400';
    if (isSelected)
      return 'w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-left border-2 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-400 text-indigo-600 dark:text-indigo-400';
    return 'w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-left border-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-500';
  };

  // Matched tiles are removed entirely (not disabled), so the remaining
  // tiles reflow and matched cards can never be re-selected.
  const visibleWordTiles = wordTiles.filter((tile) => !matchedIds.has(tile.wordId));
  const visibleMeaningTiles = meaningTiles.filter((tile) => !matchedIds.has(tile.wordId));

  return (
    <div className="relative max-w-2xl mx-auto space-y-4">
      <CelebrationBurst burstKey={burstKey} />
      <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 text-center">
        {t.practice.matchPairsHint}
      </p>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          {visibleWordTiles.map((tile) => (
            <button
              key={tile.key}
              type="button"
              onClick={() => handleSelectWord(tile)}
              aria-pressed={selectedWord?.key === tile.key}
              className={tileClass(tile, selectedWord?.key === tile.key)}
            >
              {tile.label}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {visibleMeaningTiles.map((tile) => (
            <button
              key={tile.key}
              type="button"
              onClick={() => handleSelectMeaning(tile)}
              aria-pressed={selectedMeaning?.key === tile.key}
              className={tileClass(tile, selectedMeaning?.key === tile.key)}
            >
              {tile.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const GamesSession: React.FC<GamesSessionProps> = ({ words, onComplete }) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<GameMode>('speed');

  const tabClass = (active: boolean) =>
    `flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
      active
        ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow'
        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
    }`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl max-w-xs mx-auto">
        <button type="button" onClick={() => setMode('speed')} className={tabClass(mode === 'speed')}>
          <Zap size={16} aria-hidden="true" />
          <span>{t.practice.speedRound}</span>
        </button>
        <button type="button" onClick={() => setMode('match')} className={tabClass(mode === 'match')}>
          <Grid3x3 size={16} aria-hidden="true" />
          <span>{t.practice.matchingGame}</span>
        </button>
      </div>

      {/* key= forces a full remount on mode switch, unmounting the other
          game and (via its cleanup effects) clearing its pending timers. */}
      {mode === 'speed' ? (
        <SpeedRound key="speed" words={words} onComplete={onComplete} />
      ) : (
        <MatchingGame key="match" words={words} onComplete={onComplete} />
      )}
    </div>
  );
};

export default GamesSession;
