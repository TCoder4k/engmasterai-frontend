import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StudentLayout from '../user/StudentLayout';
import { getPublishedLibraries } from '../../services/vocabLibraryService';
import { getLibrariesProgress, LibrarySummaryProgress } from '../../services/learningService';
import { getPersonalVocabStats, PersonalVocabStats } from '../../services/vocabPersonalService';
import { handleAuthError } from '../../services/apiError';
import { VocabLibrary } from '../../types';
import { ArrowRight, Library as LibraryIcon, BookMarked } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

// The vocabulary shelf. Every library shown here is one the backend actually
// published — this page deliberately does NO client-side filtering by name.
// (When test fixtures once leaked into the dev database and appeared here,
// the fix was test-database isolation, not a name blocklist in the UI; see
// docs/memory.md's Sprint 04D entry.)
//
// Sprint 04D: each card now shows real deck/word counts and real
// started/mastered percentages from GET /learning/libraries/progress —
// fetched separately so a progress failure degrades only the counts, never
// the shelf itself. Nothing here is fabricated: a card with no progress data
// simply shows no progress line.
const VocabLibraryPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [libraries, setLibraries] = useState<VocabLibrary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progressById, setProgressById] = useState<Map<string, LibrarySummaryProgress>>(new Map());
  const [myVocabStats, setMyVocabStats] = useState<PersonalVocabStats | null>(null);

  useEffect(() => {
    getPublishedLibraries()
      .then((res) => setLibraries(res.data))
      .catch((err) => setError(handleAuthError(err, navigate) || t.common.loadFailed))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Supplementary — a failure here leaves the cards without their counts
  // rather than breaking the page or showing placeholder numbers.
  useEffect(() => {
    let cancelled = false;
    getLibrariesProgress()
      .then((res) => {
        if (!cancelled) setProgressById(new Map(res.data.map((p) => [p.libraryId, p])));
      })
      .catch(() => {
        // Intentionally silent — see the comment above.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Same failure-tolerant, supplementary-only pattern as the progress fetch
  // above — powers the featured banner's stat cluster below. A failure just
  // means the banner shows no numbers, never a placeholder/fabricated one.
  useEffect(() => {
    let cancelled = false;
    getPersonalVocabStats()
      .then((res) => {
        if (!cancelled) setMyVocabStats(res);
      })
      .catch(() => {
        // Intentionally silent — see the comment above.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <StudentLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h2 className="text-[22px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
            {t.vocab.title}
          </h2>
          <div className="h-1 w-12 bg-blue-500 mt-2.5 rounded-full"></div>
        </div>

        {/* "Từ vựng của tôi" — a student's own saved-word list, distinct from
            the admin-curated shelf below. A featured card, not a small
            top-right pill (the earlier treatment read as disconnected from
            the page) and not a full-width bar either (owner feedback: a
            full-width blue banner left the whole right half empty on wide
            screens) — a compact card pinned to the top-right corner, about
            half the row's width, in a distinct orange/amber gradient so it
            visually reads as "featured" against the library cards below.
            Single-row layout (owner feedback on the two-block version: too
            tall/busy) — the caption line under the title IS the concrete
            reason to click: once stats load it swaps from the generic
            pageSubtitle description to the real total-saved (+ due-today,
            appended only when > 0) count, rather than showing both a
            description AND a separate stat block. */}
        <div className="mb-8 flex justify-end">
          <Link
            to="/vocab/my-words"
            className="relative overflow-hidden flex items-center gap-3 rounded-[24px] bg-gradient-to-r from-orange-500 to-amber-500 p-5 sm:p-6 text-white shadow-xl shadow-orange-500/20 dark:shadow-black/30 transition-transform duration-300 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 w-full sm:w-1/2"
          >
            {/* Purely decorative — never announced to AT. */}
            <BookMarked
              size={110}
              strokeWidth={1.25}
              aria-hidden="true"
              className="pointer-events-none absolute -right-5 -bottom-8 text-white/10"
            />

            <div className="relative flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
              <BookMarked size={22} aria-hidden="true" />
            </div>
            <div className="relative min-w-0 flex-1">
              <h3 className="text-[15px] sm:text-[16px] font-extrabold leading-tight">{t.myVocab.navLink}</h3>
              <p className="mt-0.5 text-[12px] font-medium text-orange-50/90 leading-relaxed truncate">
                {myVocabStats && myVocabStats.total > 0 ? (
                  <>
                    <span className="font-bold">{myVocabStats.total}</span> {t.myVocab.bannerSavedWords}
                    {myVocabStats.dueTodayCount > 0 && (
                      <>
                        {' '}
                        · {myVocabStats.dueTodayCount} {t.myVocab.reviewTodayCount}
                      </>
                    )}
                  </>
                ) : (
                  t.myVocab.pageSubtitle
                )}
              </p>
            </div>
            <ArrowRight size={20} className="relative shrink-0 text-white/80" aria-hidden="true" />
          </Link>
        </div>

        {isLoading && (
          <p className="text-sm font-medium text-slate-400 dark:text-slate-500">{t.common.loading}</p>
        )}

        {error && (
          <p className="text-sm font-medium text-rose-500 mb-6">{error}</p>
        )}

        {!isLoading && !error && libraries.length === 0 && (
          <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
            {t.vocab.noLibraries}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {libraries.map((library) => {
            const progress = progressById.get(library.id);
            return (
              // Sprint 05: the card is a container, not one big <Link>. The
              // due-review action below needs to be its own link, and a
              // <Link> inside a <Link> is invalid HTML — the same
              // restructure LibraryDetailPage's deck rows got in 04D.
              <div
                key={library.id}
                className="bg-white dark:bg-slate-900 rounded-[24px] shadow-lg dark:shadow-none p-8 flex flex-col items-center text-center h-full group transition-all duration-300 hover:border-blue-100 dark:hover:border-blue-500/40 border border-transparent dark:border-slate-800"
              >
                <Link
                  to={`/vocab/libraries/${library.id}`}
                  className="flex flex-col items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-2xl"
                >
                  <div className="w-20 h-20 rounded-2xl border-4 border-slate-50 dark:border-slate-800 group-hover:border-blue-50 dark:group-hover:border-blue-500/20 overflow-hidden bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-500 dark:text-blue-400 mb-6 transition-all duration-300">
                    {library.thumbnail ? (
                      <img src={library.thumbnail} alt={library.name} className="w-full h-full object-cover" />
                    ) : (
                      <LibraryIcon size={32} aria-hidden="true" />
                    )}
                  </div>
                  <h3 className="text-[18px] font-extrabold text-slate-900 dark:text-slate-100 mb-3 leading-tight group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
                    {library.name}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-[14px] leading-relaxed font-medium">
                    {library.description}
                  </p>
                </Link>

                {progress && (
                  <div className="mt-5 w-full space-y-2">
                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                      {progress.deckCount} {t.vocab.decksCount} · {progress.totalWords} {t.vocab.wordsUnit}
                    </p>
                    {progress.totalWords > 0 && (
                      <>
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${progress.startedPercent}%` }}
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
                          />
                        </div>
                        <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                          {t.vocab.startedLabel}: {progress.startedPercent}% · {t.vocab.masteredLabel}:{' '}
                          {progress.masteredPercent}%
                        </p>
                        {/* Sprint 05 — this page showed a real due count but
                            linked nowhere. Rendered only when words are
                            actually due; at zero there is no action and
                            nothing is implied. */}
                        {progress.dueWords > 0 && (
                          <Link
                            to={`/practice/review?libraryId=${library.id}`}
                            className="mt-1 inline-flex items-center justify-center gap-1.5 w-full px-4 py-2.5 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20 text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                          >
                            <span>
                              {t.vocab.reviewDueAction} ({progress.dueWords})
                            </span>
                            <ArrowRight size={14} aria-hidden="true" />
                          </Link>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </StudentLayout>
  );
};

export default VocabLibraryPage;
