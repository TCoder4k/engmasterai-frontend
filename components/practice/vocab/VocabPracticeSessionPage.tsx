import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import StudentLayout from '../../user/StudentLayout';
import EmptyState from '../../shared/EmptyState';
import ErrorState from '../../shared/ErrorState';
import Skeleton from '../../shared/Skeleton';
import { useStudyActivity } from '../../shared/StudyTimeBoundary';
import ModeSelectorBar from '../ModeSelectorBar';
import SessionHeader from './SessionHeader';
import FlashcardSession from './FlashcardSession';
import DictationSession from './DictationSession';
import GamesSession from './GamesSession';
import SessionSummary from '../SessionSummary';
import { getPublishedDeck, getPublishedDeckWords } from '../../../services/vocabDeckService';
import { getPublishedLibrary } from '../../../services/vocabLibraryService';
import { handleAuthError } from '../../../services/apiError';
import { useTranslation } from '../../../i18n/useTranslation';
import { VocabDeck, VocabWordListItem } from '../../../types';
import { VocabPracticeMode, SessionResult } from '../types';
import { BookMarked } from 'lucide-react';

const VALID_PRACTICE_MODES: VocabPracticeMode[] = ['flashcard', 'dictation', 'games', 'contextual'];

// /practice/vocab/:deckId — hosts the vocabulary practice modes against
// real deck/word data. As of Sprint 04C, Flashcard's Again/Hard/Good/Easy
// ratings are real, persisted per-user SRS progress (POST
// /learning/words/:wordId/review) — Dictation submits a suggested rating
// the user must confirm; Games stays session-score-only, no SRS mutation
// (see each component's own header comment). The `sessionKey`/`result`
// state on this page itself (mode switching, session completion/restart)
// remains purely local, unrelated to that persisted progress. The ?mode=
// search param keeps back-button/deep links sane without a route per mode.
const VocabPracticeSessionPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { deckId } = useParams<{ deckId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [deck, setDeck] = useState<VocabDeck | null>(null);
  const [libraryName, setLibraryName] = useState('');
  const [words, setWords] = useState<VocabWordListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [sessionKey, setSessionKey] = useState(0);

  // Flashcard is the canonical initial mode: no ?mode= param (the normal
  // entry from the vocabulary library page) and any unrecognized value both
  // fall back to it safely, rather than silently landing on a blank/"coming
  // soon" state for a typo'd or hand-edited URL.
  const requestedMode = searchParams.get('mode');
  const mode: VocabPracticeMode = VALID_PRACTICE_MODES.includes(requestedMode as VocabPracticeMode)
    ? (requestedMode as VocabPracticeMode)
    : 'flashcard';

  // Sprint 10.5 — flashcard, dictation and games are all intentional learning
  // and all count. They share one activity type and are told apart by deckId;
  // the mode is not a dimension the dashboard asks about.
  //
  // Inactive once the summary is showing: reading your own score is not study,
  // and the session screen can sit there indefinitely.
  useStudyActivity({
    type: 'VOCAB_PRACTICE',
    activityId: deckId,
    active: Boolean(deckId) && !result,
  });

  useEffect(() => {
    if (!deckId) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const deckRes = await getPublishedDeck(deckId);
        const [libraryRes, wordsRes] = await Promise.all([
          getPublishedLibrary(deckRes.libraryId),
          getPublishedDeckWords(deckId),
        ]);
        if (cancelled) return;
        setDeck(deckRes);
        setLibraryName(libraryRes.name);
        setWords(wordsRes.data);
      } catch (err) {
        if (!cancelled) setError(handleAuthError(err, navigate) || t.common.loadFailed);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  const handleSelectMode = (nextMode: VocabPracticeMode) => {
    setResult(null);
    setSessionKey((k) => k + 1);
    setSearchParams({ mode: nextMode }, { replace: true });
  };

  const handleComplete = (sessionResult: SessionResult) => {
    setResult(sessionResult);
  };

  const handleRestart = () => {
    setResult(null);
    setSessionKey((k) => k + 1);
  };

  // Exits back to the deck's own vocabulary library — not the generic
  // Practice Hub — matching the canonical Vocabulary -> Library -> Deck ->
  // Flashcard flow (Sprint 03D). Falls back to the library list only in the
  // unreachable case this fires before the deck has loaded.
  const handleExit = () => navigate(deck ? `/vocab/libraries/${deck.libraryId}` : '/vocab');

  if (isLoading) {
    return (
      <StudentLayout>
        <div className="max-w-4xl mx-auto space-y-5">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </StudentLayout>
    );
  }

  if (error || !deck) {
    return (
      <StudentLayout>
        <div className="max-w-4xl mx-auto space-y-4">
          <button
            type="button"
            onClick={() => navigate('/vocab')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-blue-500 dark:text-slate-500 dark:hover:text-blue-400 transition-colors"
          >
            {t.vocab.backToVocab}
          </button>
          <ErrorState message={error || t.common.loadFailed} />
        </div>
      </StudentLayout>
    );
  }

  if (words.length === 0) {
    return (
      <StudentLayout>
        <div className="max-w-4xl mx-auto space-y-5">
          <SessionHeader deckName={deck.name} libraryName={libraryName} wordCount={0} onExit={handleExit} />
          <EmptyState icon={<BookMarked size={32} />} message={t.vocab.deckNoWords} />
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div className="max-w-4xl mx-auto space-y-5">
        <SessionHeader
          deckName={deck.name}
          libraryName={libraryName}
          wordCount={words.length}
          onExit={handleExit}
        />

        <ModeSelectorBar activeMode={mode} onSelect={handleSelectMode} />

        {result ? (
          <SessionSummary result={result} onRestart={handleRestart} onExit={handleExit} />
        ) : mode === 'flashcard' ? (
          <FlashcardSession key={sessionKey} words={words} onComplete={handleComplete} />
        ) : mode === 'dictation' ? (
          <DictationSession key={sessionKey} words={words} onComplete={handleComplete} />
        ) : mode === 'games' ? (
          <GamesSession key={sessionKey} words={words} onComplete={handleComplete} />
        ) : (
          <EmptyState message={t.practice.comingSoonMode} />
        )}
      </div>
    </StudentLayout>
  );
};

export default VocabPracticeSessionPage;
