import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import StudentLayout from '../user/StudentLayout';
import EmptyState from '../shared/EmptyState';
import ErrorState from '../shared/ErrorState';
import Skeleton from '../shared/Skeleton';
import { getPublishedLibrary } from '../../services/vocabLibraryService';
import { getPublishedDecksByLibrary } from '../../services/vocabDeckService';
import { getLibraryProgress, LibraryProgress, DeckProgress } from '../../services/learningService';
import { handleAuthError } from '../../services/apiError';
import { VocabLibrary, VocabDeck } from '../../types';
import { ArrowLeft, Library as LibraryIcon, Layers, Clock3 } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

// /vocab/libraries/:id — the vocabulary library learning overview (Sprint
// 03D). This is the canonical entry point into vocabulary practice: a deck
// action goes directly to Flashcard mode
// (/practice/vocab/:deckId?mode=flashcard), or to the due-review session
// (/practice/review?deckId=...) when that deck actually has words due.
//
// Sprint 04D (UI repair): the Overall Progress card and every deck row show
// real data from GET /learning/libraries/:id/progress. The old
// "progressComingSoon" placeholder was REMOVED, not kept as a fallback — it
// was rendering on first paint and permanently on any fetch failure, long
// after real progress data existed, which made a working feature look
// unbuilt. The three honest states are now distinct: loading (skeleton),
// failed (an explicit "couldn't load" message), and genuinely empty
// (totalWords === 0). None of them invents a number.
type ProgressStatus = 'loading' | 'loaded' | 'failed';

// Which action a deck row offers, derived entirely from real server counts.
// Order matters: due words win over everything (that is the whole point of
// spaced repetition), then fully-mastered, then untouched, then partial.
const resolveDeckAction = (
  deckProgress: DeckProgress | undefined,
  t: ReturnType<typeof useTranslation>['t'],
): { label: string; to: string } | null => {
  if (!deckProgress || deckProgress.totalWords === 0) return null;
  if (deckProgress.dueWords > 0) {
    return { label: t.vocab.reviewDueAction, to: `/practice/review?deckId=${deckProgress.deckId}` };
  }
  const flashcardHref = `/practice/vocab/${deckProgress.deckId}?mode=flashcard`;
  if (deckProgress.masteredWords === deckProgress.totalWords) {
    return { label: t.vocab.practiceAgain, to: flashcardHref };
  }
  if (deckProgress.newWords === deckProgress.totalWords) {
    return { label: t.vocab.startPractice, to: flashcardHref };
  }
  return { label: t.vocab.continuePractice, to: flashcardHref };
};

const LibraryDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [library, setLibrary] = useState<VocabLibrary | null>(null);
  const [decks, setDecks] = useState<VocabDeck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<LibraryProgress | null>(null);
  const [progressStatus, setProgressStatus] = useState<ProgressStatus>('loading');

  const loadData = useCallback(() => {
    if (!id) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    Promise.all([getPublishedLibrary(id), getPublishedDecksByLibrary(id)])
      .then(([libraryRes, decksRes]) => {
        if (cancelled) return;
        setLibrary(libraryRes);
        setDecks(decksRes.data);
      })
      .catch((err) => {
        if (!cancelled) setError(handleAuthError(err, navigate) || t.common.loadFailed);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => loadData(), [loadData]);

  // Supplementary — a failed progress fetch never blocks the page or takes
  // over the whole screen with an error; it degrades just this one card.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setProgressStatus('loading');
    getLibraryProgress(id)
      .then((res) => {
        if (cancelled) return;
        setProgress(res);
        setProgressStatus('loaded');
      })
      .catch(() => {
        if (!cancelled) setProgressStatus('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // The library-level total counts DISTINCT words, which is what the server
  // reports. Summing `deck._count.deckWords` instead (as this page used to)
  // double-counts any word attached to more than one deck, so the header
  // could contradict the progress card directly below it. The sum is only
  // used as a fallback before/if progress loads — see t.vocab.sharedWordNote
  // for how the difference is explained to the user.
  const deckWordSum = decks.reduce((sum, deck) => sum + deck._count.deckWords, 0);
  const totalWords = progress ? progress.totalWords : deckWordSum;
  const hasSharedWords = progress !== null && deckWordSum > progress.totalWords;

  return (
    <StudentLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <Link
          to="/vocab"
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-400 hover:text-blue-500 dark:text-slate-500 dark:hover:text-blue-400 transition-colors min-h-[44px]"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          <span>{t.vocab.backToLibraries}</span>
        </Link>

        {isLoading && (
          <div className="space-y-6" aria-busy="true">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-20 w-full" />
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        )}

        {!isLoading && error && <ErrorState message={error} onRetry={loadData} />}

        {!isLoading && !error && library && (
          <>
            <header className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <div
                  className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-500 dark:text-blue-400 shrink-0 overflow-hidden"
                  aria-hidden="true"
                >
                  {library.thumbnail ? (
                    <img src={library.thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <LibraryIcon size={28} />
                  )}
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 leading-tight">
                    {library.name}
                  </h1>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                    {library.description}
                  </p>
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mt-4">
                    {decks.length} {t.vocab.decksCount} · {totalWords} {t.vocab.wordsUnit}
                  </p>
                </div>
              </div>
            </header>

            <section
              aria-labelledby="vocab-overall-progress-heading"
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm p-6"
            >
              <h2
                id="vocab-overall-progress-heading"
                className="text-xs font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide mb-3"
              >
                {t.vocab.overallProgress}
              </h2>

              {progressStatus === 'loading' && (
                <div className="space-y-3" aria-busy="true">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="h-4 w-56" />
                </div>
              )}

              {progressStatus === 'failed' && (
                <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">
                  {t.vocab.progressLoadFailed}
                </p>
              )}

              {progressStatus === 'loaded' && progress && progress.totalWords === 0 && (
                <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">{t.vocab.libraryNoWords}</p>
              )}

              {progressStatus === 'loaded' && progress && progress.totalWords > 0 && (
                <div className="space-y-4">
                  {/* Two separate bars, never one: "started" measures
                      exposure and "mastered" measures actual learning. A
                      single bar would have to silently pick one meaning. */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                      <span>{t.vocab.startedLabel}</span>
                      <span>{progress.startedPercent}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${progress.startedPercent}%` }}
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                      <span>{t.vocab.masteredLabel}</span>
                      <span>{progress.masteredPercent}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${progress.masteredPercent}%` }}
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-300"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                    <span>
                      {t.vocab.newUnit}: {progress.newWords}
                    </span>
                    <span>
                      {t.vocab.learningUnit}: {progress.learningWords}
                    </span>
                    <span>
                      {t.vocab.reviewUnit}: {progress.reviewWords}
                    </span>
                    <span>
                      {t.vocab.dueTodayLabel}: {progress.dueWords}
                    </span>
                  </div>

                  {progress.dueWords > 0 && (
                    <Link
                      to={`/practice/review?libraryId=${id}`}
                      className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <Clock3 size={14} aria-hidden="true" />
                      <span>
                        {progress.dueWords} {t.vocab.dueWordsCta}
                      </span>
                    </Link>
                  )}

                  {hasSharedWords && (
                    <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 leading-relaxed">
                      {t.vocab.sharedWordNote}
                    </p>
                  )}
                </div>
              )}
            </section>

            <section aria-labelledby="vocab-deck-list-heading" className="space-y-3">
              <h2
                id="vocab-deck-list-heading"
                className="text-xs font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide"
              >
                {t.vocab.decks}
              </h2>

              {decks.length === 0 && <EmptyState icon={<Layers size={32} />} message={t.vocab.noDecks} />}

              {decks.map((deck, index) => {
                const deckProgress = progress?.decks.find((d) => d.deckId === deck.id);
                const action = resolveDeckAction(deckProgress, t);
                // A deck with no words has no honest action — linking into a
                // practice session would just open a broken empty session.
                const isEmptyDeck = deck._count.deckWords === 0;

                return (
                  <div
                    key={deck.id}
                    className="flex items-center gap-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-5"
                  >
                    <span
                      className="shrink-0 w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-mono font-bold text-sm flex items-center justify-center"
                      aria-hidden="true"
                    >
                      {index + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      {/* The deck name links to its own detail page; the
                          action button below is a SEPARATE link. The whole
                          row used to be one <Link>, which cannot contain a
                          second link (invalid HTML) — and the two now go to
                          genuinely different places. */}
                      <Link
                        to={`/vocab/decks/${deck.id}`}
                        className="text-sm font-extrabold text-slate-900 dark:text-slate-100 leading-snug break-words hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
                      >
                        {deck.name}
                      </Link>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                          {deck._count.deckWords} {t.vocab.wordsUnit}
                        </span>

                        {deckProgress && deckProgress.totalWords > 0 && (
                          <>
                            <span className="text-slate-200 dark:text-slate-700" aria-hidden="true">
                              ·
                            </span>
                            <span className="text-xs font-semibold text-blue-500 dark:text-blue-400">
                              {t.vocab.startedLabel}: {deckProgress.startedPercent}%
                            </span>
                            <span className="text-slate-200 dark:text-slate-700" aria-hidden="true">
                              ·
                            </span>
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              {t.vocab.masteredLabel}: {deckProgress.masteredPercent}%
                            </span>
                            {deckProgress.dueWords > 0 && (
                              <>
                                <span className="text-slate-200 dark:text-slate-700" aria-hidden="true">
                                  ·
                                </span>
                                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                                  {t.vocab.dueTodayLabel}: {deckProgress.dueWords}
                                </span>
                              </>
                            )}
                          </>
                        )}

                        {/* Honest, distinct fallbacks: a deck with no words
                            is genuinely empty; one whose progress simply
                            hasn't arrived says so rather than implying the
                            student has not started it. */}
                        {!deckProgress && (
                          <>
                            <span className="text-slate-200 dark:text-slate-700" aria-hidden="true">
                              ·
                            </span>
                            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                              {isEmptyDeck
                                ? t.vocab.deckNoWords
                                : progressStatus === 'failed'
                                  ? t.vocab.deckProgressUnavailable
                                  : t.vocab.deckNotStarted}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {action && (
                      <Link
                        to={action.to}
                        className="shrink-0 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      >
                        {action.label}
                      </Link>
                    )}
                    {/* Before progress resolves we still offer the canonical
                        Flashcard entry for any non-empty deck, so the page is
                        never actionless while loading. */}
                    {!action && !isEmptyDeck && (
                      <Link
                        to={`/practice/vocab/${deck.id}?mode=flashcard`}
                        className="shrink-0 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      >
                        {t.vocab.startPractice}
                      </Link>
                    )}
                  </div>
                );
              })}
            </section>
          </>
        )}
      </div>
    </StudentLayout>
  );
};

export default LibraryDetailPage;
