import React, { useEffect, useRef, useState } from 'react';
import { Eye, Type, Star, Flag } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';
import { playCorrect } from '../../../services/feedbackSounds';
import CelebrationBurst from '../../shared/CelebrationBurst';
import { DictationSegment } from './listeningContent';

export type WorkspaceFontSize = 'normal' | 'large' | 'xlarge';

// assisted=true when any word was revealed (hint-reveal or reveal-all) — a
// revealed word never counts as independently earned. wordsCorrect/wordsTotal
// are real, this-segment word counts (Sprint 03G) — wordsCorrect excludes
// revealed words from the numerator, so a lesson-wide accuracy stat derived
// from these can't be masked by a segment merely reaching "solved".
export interface SegmentSolvedResult {
  assisted: boolean;
  wordsCorrect: number;
  wordsTotal: number;
}

interface DictationWorkspaceProps {
  segment: DictationSegment;
  segmentNumber: number;
  totalSegments: number;
  fontSize: WorkspaceFontSize;
  onFontSizeChange: (size: WorkspaceFontSize) => void;
  isSentenceSaved: boolean;
  onToggleSaveSentence: () => void;
  onSegmentSolved: (result: SegmentSolvedResult) => void;
  onAdvance: () => void;
  onPlayPause: () => void;
  onReplay: () => void;
}

const cleanWord = (word: string): string => word.toLowerCase().replace(/[^a-z0-9']/g, '');

// Keyboard map (Sprint 03F, locked): Space play/pause · standalone Ctrl
// replay · Alt+H first-letter hint · Alt+R reveal word · Enter
// next-when-solved. Never Ctrl+R (browser refresh) or any other Ctrl combo
// (copy/paste/etc) — see the keydown/keyup candidate tracking below, which
// only fires replay for a truly standalone Ctrl press/release. All
// shortcuts except Enter/Alt+H/Alt+R/Ctrl are ignored while typing in the
// answer box; Space calls preventDefault so it never scrolls the page.
const DictationWorkspace: React.FC<DictationWorkspaceProps> = ({
  segment,
  segmentNumber,
  totalSegments,
  fontSize,
  onFontSizeChange,
  isSentenceSaved,
  onToggleSaveSentence,
  onSegmentSolved,
  onAdvance,
  onPlayPause,
  onReplay,
}) => {
  const { t } = useTranslation();
  const [typedText, setTypedText] = useState('');
  const [revealedWordIndices, setRevealedWordIndices] = useState<number[]>([]);
  const [solved, setSolved] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Bare-Ctrl replay candidate — a ref (not state) since it must be checked
  // and invalidated synchronously within the same keydown/keyup handlers
  // without triggering re-renders.
  const ctrlCandidateRef = useRef(false);

  const targetWords = segment.textEn.split(' ');
  const cleanTargetWords = targetWords.map(cleanWord);
  const typedWords = typedText.trim().length > 0 ? typedText.trim().split(/\s+/) : [];
  const cleanTypedWords = typedWords.map(cleanWord);

  let matchedCount = 0;
  const wordStatuses = targetWords.map((word, idx) => {
    if (revealedWordIndices.includes(idx)) {
      matchedCount++;
      return { text: word, status: 'revealed' as const };
    }
    const typedClean = cleanTypedWords[idx];
    const targetClean = cleanTargetWords[idx];
    if (!typedClean) return { text: '•'.repeat(Math.max(2, word.length)), status: 'untyped' as const };
    if (typedClean === targetClean) {
      matchedCount++;
      return { text: word, status: 'correct' as const };
    }
    if (targetClean.startsWith(typedClean)) return { text: typedWords[idx], status: 'partial' as const };
    return { text: typedWords[idx], status: 'incorrect' as const };
  });

  const accuracyPercent = Math.round((matchedCount / targetWords.length) * 100);

  useEffect(() => {
    setTypedText('');
    setRevealedWordIndices([]);
    setSolved(false);
    textareaRef.current?.focus();
  }, [segment.id]);

  useEffect(() => {
    if (accuracyPercent === 100 && !solved) {
      setSolved(true);
      playCorrect();
      setBurstKey((k) => k + 1);
      onSegmentSolved({
        assisted: revealedWordIndices.length > 0,
        wordsCorrect: targetWords.length - revealedWordIndices.length,
        wordsTotal: targetWords.length,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accuracyPercent]);

  const firstUnsolvedIndex = (): number =>
    targetWords.findIndex(
      (_, idx) => !revealedWordIndices.includes(idx) && cleanTypedWords[idx] !== cleanTargetWords[idx],
    );

  const setWordAt = (idx: number, value: string) => {
    const words = typedText.trim().length > 0 ? typedText.split(/\s+/) : [];
    while (words.length <= idx) words.push('');
    words[idx] = value;
    setTypedText(words.join(' '));
  };

  const handleFirstLetterHint = () => {
    const idx = firstUnsolvedIndex();
    if (idx === -1) return;
    if (!typedWords[idx]) setWordAt(idx, targetWords[idx][0]);
  };

  const handleRevealWord = (explicitIdx?: number) => {
    const idx = explicitIdx ?? firstUnsolvedIndex();
    if (idx === -1) return;
    setRevealedWordIndices((prev) => (prev.includes(idx) ? prev : [...prev, idx]));
  };

  const handleRevealAll = () => {
    setRevealedWordIndices(targetWords.map((_, i) => i));
    setTypedText(segment.textEn);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT';

      // Bare-Ctrl replay candidate tracking — runs before any isTyping gate
      // so it works even while the answer textarea is focused. Control
      // itself never gets preventDefault (never touch browser semantics for
      // the modifier key on its own).
      if (e.key === 'Control') {
        if (!e.repeat) ctrlCandidateRef.current = true;
        return;
      }
      if (ctrlCandidateRef.current) {
        // Any other key seen while Control is held means this wasn't a
        // standalone Ctrl press — invalidate so keyup won't replay, and let
        // the browser handle Ctrl+<key> natively (Ctrl+R, Ctrl+C, etc).
        ctrlCandidateRef.current = false;
      }

      // Enter keeps normal form semantics even while typing: never insert a
      // newline, and advance once the sentence is solved (there is no
      // separate "check" step — the word diff evaluates continuously).
      if (e.key === 'Enter' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        if (solved) onAdvance();
        return;
      }

      // Alt combos work everywhere except while typing (they don't type
      // characters, but keeping them out of the input avoids surprises).
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key.toLowerCase() === 'h') {
          e.preventDefault();
          handleFirstLetterHint();
          return;
        }
        if (e.key.toLowerCase() === 'r') {
          e.preventDefault();
          handleRevealWord();
          return;
        }
      }

      if (isTyping) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.code === 'Space') {
        // preventDefault so Space never scrolls the page while it acts as
        // play/pause.
        e.preventDefault();
        onPlayPause();
      } else if (e.key.toLowerCase() === 'r') {
        // Kept alongside the new standalone-Ctrl replay — Sprint 03F adds
        // Ctrl as a replay trigger, it doesn't remove the existing plain-R
        // one (only the top shortcut hint no longer advertises R).
        e.preventDefault();
        onReplay();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' && ctrlCandidateRef.current) {
        ctrlCandidateRef.current = false;
        onReplay();
      }
    };

    const handleBlur = () => {
      // Window lost focus mid-hold — don't let a stale candidate fire a
      // spurious replay on a later, unrelated Control keyup.
      ctrlCandidateRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment.id, solved, typedText, revealedWordIndices]);

  const answerTextClass =
    fontSize === 'normal' ? 'text-sm sm:text-base' : fontSize === 'large' ? 'text-base sm:text-lg' : 'text-lg sm:text-xl';
  const chipTextClass = fontSize === 'xlarge' ? 'text-sm sm:text-base' : 'text-xs sm:text-sm';

  return (
    <div className="relative bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm p-6 sm:p-8 space-y-5">
      <CelebrationBurst burstKey={burstKey} />

      {/* Real session-derived status: segment number, matched word count,
          accuracy — computed from this segment's live diff, never stored
          or fabricated. */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2" role="status" aria-live="off">
          <span className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-mono rounded-lg">
            {t.practice.questionLabel} {segmentNumber}/{totalSegments}
          </span>
          <span>
            {matchedCount}/{targetWords.length} {t.practice.listeningWordsUnit}
          </span>
          <span
            className={`px-2 py-0.5 rounded-md font-bold border ${
              accuracyPercent === 100
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}
          >
            {t.practice.listeningMatch}: {accuracyPercent}%
          </span>
          {solved && (
            <span
              key={burstKey}
              className="practice-fade-in text-emerald-600 dark:text-emerald-400 font-bold"
            >
              ✓ {t.practice.correct}
            </span>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          <span className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 font-mono text-[10px]">
            {t.practice.listeningCtrlReplayHint}
          </span>
          <span className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 font-mono text-[10px]">
            {t.practice.listeningEnterNextHint}
          </span>
        </div>
      </div>

      {/* Action toolbar: save (session-only, honestly labeled), report
          (disabled — no backend endpoint exists; see sprint report), font
          size. */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggleSaveSentence}
          aria-pressed={isSentenceSaved}
          title={t.practice.sessionOnlySaveNote}
          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
            isSentenceSaved
              ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500 text-amber-600 dark:text-amber-400'
              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Star size={14} className={isSentenceSaved ? 'fill-amber-400 text-amber-400' : ''} aria-hidden="true" />
          <span>{isSentenceSaved ? t.practice.savedSentence : t.practice.saveSentence}</span>
        </button>

        <button
          type="button"
          disabled
          title={t.common.comingSoon}
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 text-xs font-bold cursor-not-allowed flex items-center gap-1.5"
        >
          <Flag size={14} aria-hidden="true" />
          <span>
            {t.practice.reportIssue} <span className="uppercase text-[9px]">({t.common.soon})</span>
          </span>
        </button>

        <div
          role="group"
          aria-label={t.practice.fontSizeLabel}
          className="ml-auto flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-0.5"
        >
          {(['normal', 'large', 'xlarge'] as const).map((size, i) => (
            <button
              key={size}
              type="button"
              onClick={() => onFontSizeChange(size)}
              aria-pressed={fontSize === size}
              className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                fontSize === size
                  ? 'bg-indigo-500 text-white'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {i === 0 ? '-A' : i === 1 ? 'A' : '+A'}
            </button>
          ))}
        </div>
      </div>

      <textarea
        ref={textareaRef}
        value={typedText}
        onChange={(e) => setTypedText(e.target.value)}
        placeholder={t.practice.typeWhatYouHear}
        rows={2}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className={`w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-400 dark:focus:border-indigo-500 rounded-2xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 font-medium resize-none focus:outline-none ${answerTextClass}`}
      />

      {solved && (
        <p className="practice-fade-in text-xs text-slate-400 dark:text-slate-500 italic">{segment.textVi}</p>
      )}

      <div className="flex flex-wrap gap-2 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl min-h-[56px] items-center">
        {wordStatuses.map((item, idx) => {
          const chipClass =
            item.status === 'correct'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold'
              : item.status === 'revealed'
                ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-500 text-amber-700 dark:text-amber-300 font-bold'
                : item.status === 'partial'
                  ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-500 text-amber-700 dark:text-amber-300 font-bold'
                  : item.status === 'incorrect'
                    ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-500 text-rose-700 dark:text-rose-300 font-bold'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600';
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleRevealWord(idx)}
              // Masked placeholders are decorative dots — hide the fake
              // dot text from assistive tech; the real word is exposed
              // only once typed or revealed.
              aria-label={item.status === 'untyped' ? `${t.practice.listeningRevealWord} ${idx + 1}` : undefined}
              className={`px-3 py-1.5 rounded-xl border transition-colors ${chipTextClass} ${chipClass}`}
            >
              <span aria-hidden={item.status === 'untyped'}>{item.text}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleFirstLetterHint}
          className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5"
        >
          <Type size={14} className="text-indigo-500 dark:text-indigo-400" aria-hidden="true" />
          <span>
            {t.practice.listeningHintFirstLetter}{' '}
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">[Alt+H]</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => handleRevealWord()}
          className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5"
        >
          <Eye size={14} className="text-amber-500" aria-hidden="true" />
          <span>
            {t.practice.listeningRevealWord}{' '}
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">[Alt+R]</span>
          </span>
        </button>
        <button
          type="button"
          onClick={handleRevealAll}
          className="px-3.5 py-2 text-indigo-600 dark:text-indigo-400 hover:underline font-bold text-xs rounded-xl transition-colors"
        >
          {t.practice.listeningRevealAll}
        </button>

        <button
          type="button"
          onClick={onAdvance}
          disabled={!solved}
          className="ml-auto px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl text-xs sm:text-sm font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <span>{t.practice.listeningNextAction}</span>
        </button>
      </div>

      {/* Solved status for screen readers (visual: green chips + burst). */}
      <p role="status" aria-live="polite" className="sr-only">
        {solved ? t.practice.correct : ''}
      </p>
    </div>
  );
};

export default DictationWorkspace;
