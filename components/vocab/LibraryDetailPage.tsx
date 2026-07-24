import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import StudentLayout from '../user/StudentLayout';
import EmptyState from '../shared/EmptyState';
import ErrorState from '../shared/ErrorState';
import Skeleton from '../shared/Skeleton';
import { getPublishedLibrary } from '../../services/vocabLibraryService';
import { getPublishedDecksByLibrary } from '../../services/vocabDeckService';
import { handleAuthError } from '../../services/apiError';
import { VocabLibrary, VocabDeck } from '../../types';
import { ArrowLeft, Library as LibraryIcon, Layers, Sparkles } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

// /vocab/libraries/:id — the vocabulary library learning overview (Sprint
// 03D). This is now the canonical entry point into vocabulary practice: a
// deck row/action goes directly to Flashcard mode
// (/practice/vocab/:deckId?mode=flashcard), not through the generic
// Practice Hub.
//
// Critical data rule: no Vocabulary Phase 3 (SRS) backend exists yet — see
// docs/memory.md. Every number rendered here (deck count, word count) comes
// straight from the real published-deck API response; deck/library-level
// mastery, streaks, and completion state are NOT fabricated — the "Overall
// progress" section and each deck's status intentionally show an honest
// "coming soon" / "Not started" state instead of invented numbers.
const LibraryDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [library, setLibrary] = useState<VocabLibrary | null>(null);
  const [decks, setDecks] = useState<VocabDeck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Real aggregate from real per-deck counts (VocabDeckService's
  // USER_SELECT already returns _count.deckWords on this endpoint) — a
  // client-side sum of already-fetched real data, not a fabricated number.
  const totalWords = decks.reduce((sum, deck) => sum + deck._count.deckWords, 0);

  return (
    <StudentLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <Link
          to="/vocab"
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-400 hover:text-indigo-500 dark:text-slate-500 dark:hover:text-indigo-400 transition-colors min-h-[44px]"
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
                  className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 dark:text-indigo-400 shrink-0 overflow-hidden"
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
              {/* No Vocabulary Phase 3 (SRS) backend exists yet — this stays
                  an honest provisional card, never a fake percentage or
                  mastered/learning count. The layout is preserved so real
                  progress can be plugged in here once that backend ships. */}
              <div className="flex items-center gap-3 text-sm font-semibold text-slate-400 dark:text-slate-500">
                <Sparkles size={16} className="shrink-0" aria-hidden="true" />
                <span>{t.vocab.progressComingSoon}</span>
              </div>
            </section>

            <section aria-labelledby="vocab-deck-list-heading" className="space-y-3">
              <h2
                id="vocab-deck-list-heading"
                className="text-xs font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide"
              >
                {t.vocab.decks}
              </h2>

              {decks.length === 0 && <EmptyState icon={<Layers size={32} />} message={t.vocab.noDecks} />}

              {decks.map((deck, index) => (
                <Link
                  key={deck.id}
                  to={`/practice/vocab/${deck.id}?mode=flashcard`}
                  className="group flex items-center gap-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-500/40 transition-all p-4 sm:p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  <span
                    className="shrink-0 w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-mono font-bold text-sm flex items-center justify-center"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100 leading-snug break-words group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {deck.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                      <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                        {deck._count.deckWords} {t.vocab.wordsUnit}
                      </span>
                      <span className="text-slate-200 dark:text-slate-700" aria-hidden="true">
                        ·
                      </span>
                      {/* No persisted per-deck progress exists — an honest
                          neutral status, never "0% mastered". */}
                      <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                        {t.vocab.deckNotStarted}
                      </span>
                    </div>
                  </div>

                  <span className="shrink-0 px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl text-xs sm:text-sm font-bold group-hover:opacity-90 transition-opacity">
                    {t.vocab.startPractice}
                  </span>
                </Link>
              ))}
            </section>
          </>
        )}
      </div>
    </StudentLayout>
  );
};

export default LibraryDetailPage;
