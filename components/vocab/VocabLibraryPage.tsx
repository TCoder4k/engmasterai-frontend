import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StudentLayout from '../user/StudentLayout';
import { getPublishedLibraries } from '../../services/vocabLibraryService';
import { getLibrariesProgress, LibrarySummaryProgress } from '../../services/learningService';
import { handleAuthError } from '../../services/apiError';
import { VocabLibrary } from '../../types';
import { ArrowRight, Library as LibraryIcon } from 'lucide-react';
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

  return (
    <StudentLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-10">
          <h2 className="text-[22px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
            {t.vocab.title}
          </h2>
          <div className="h-1 w-12 bg-indigo-500 mt-2.5 rounded-full"></div>
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
                className="bg-white dark:bg-slate-900 rounded-[24px] shadow-lg dark:shadow-none p-8 flex flex-col items-center text-center h-full group transition-all duration-300 hover:border-indigo-100 dark:hover:border-indigo-500/40 border border-transparent dark:border-slate-800"
              >
                <Link
                  to={`/vocab/libraries/${library.id}`}
                  className="flex flex-col items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-2xl"
                >
                  <div className="w-20 h-20 rounded-2xl border-4 border-slate-50 dark:border-slate-800 group-hover:border-indigo-50 dark:group-hover:border-indigo-500/20 overflow-hidden bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 dark:text-indigo-400 mb-6 transition-all duration-300">
                    {library.thumbnail ? (
                      <img src={library.thumbnail} alt={library.name} className="w-full h-full object-cover" />
                    ) : (
                      <LibraryIcon size={32} aria-hidden="true" />
                    )}
                  </div>
                  <h3 className="text-[18px] font-extrabold text-slate-900 dark:text-slate-100 mb-3 leading-tight group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
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
                            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300"
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
