import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Headphones, ListOrdered, Clock } from 'lucide-react';
import StudentLayout from '../../user/StudentLayout';
import EmptyState from '../../shared/EmptyState';
import ErrorState from '../../shared/ErrorState';
import Skeleton from '../../shared/Skeleton';
import { useTranslation } from '../../../i18n/useTranslation';
import { CefrLevel } from '../../../types';
import {
  getListeningCatalog,
  ListeningCard,
  ListeningCatalogResponse,
} from '../../../services/listeningService';

// /practice/listening — the Listening catalog, SERVER-DRIVEN as of Sprint 11
// Phase 2.
//
// WHAT THIS REPLACED, AND WHY IT MATTERED. Until now this page rendered a
// hardcoded array from `listeningContent.ts` and issued no request at all. The
// visible consequence was that five recordings the backend correctly reported
// as invisible (drafts, in draft categories) still appeared to students —
// filed as a visibility leak, but there was no leak because there was no
// query. The backend has never been the weak point here; the missing request
// was. This page is now the only source of Listening content in the student
// app.
//
// THE CLIENT NEVER FILTERS FOR VISIBILITY, and there is nothing to filter: the
// server applies `content.isPublished && category.isPublished` and returns
// only what a student may see. Adding a client-side check would create a
// second, weaker copy of that rule — the exact shape of bug this page just
// stopped having.
//
// FILTERS ARE SERVER QUERIES, NOT ARRAY OPERATIONS. Category and level go to
// `/listening/catalog` as parameters, so a filtered view is paginated and
// counted by the same code as an unfiltered one. The old page filtered a local
// array, which is only correct while the entire catalog fits in the browser.
//
// CATEGORY CHIPS COME FROM THE RESPONSE. `categories` carries only categories
// that actually hold visible content, each with a real count. The old page
// built its chips from a TypeScript union of six topic names — a union that
// could never learn about a category an admin created, and would happily
// advertise a topic with nothing behind it.
//
// NO PROGRESS IS SHOWN, because none exists. There is no Listening progress
// model until Phase 4A. A card shows what the recording IS (level, sentence
// count, duration, modes) and never "60%" or "In progress" — a number nothing
// can back is worse than no number.

const PAGE_SIZE = 12;
const LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const formatDuration = (durationMs: number | null): string | null => {
  if (!durationMs || durationMs <= 0) return null;
  const totalMinutes = Math.round(durationMs / 60000);
  return totalMinutes < 1 ? '<1' : String(totalMinutes);
};

const ListeningCatalogPage: React.FC = () => {
  const { t } = useTranslation();

  const [response, setResponse] = useState<ListeningCatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [level, setLevel] = useState<CefrLevel | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getListeningCatalog({
        categoryId: categoryId ?? undefined,
        level: level ?? undefined,
        page,
        limit: PAGE_SIZE,
      });
      setResponse(data);
    } catch (caught) {
      // The previous response is dropped on purpose. Keeping stale cards under
      // an error banner would leave a student reading content that may since
      // have been unpublished.
      setResponse(null);
      setError(caught instanceof Error ? caught.message : t.practice.listeningLoadError);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, level, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const chipClass = (active: boolean) =>
    `px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
      active
        ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow'
        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
    }`;

  const selectCategory = (next: string | null) => {
    setCategoryId(next);
    setPage(1);
  };

  const selectLevel = (next: CefrLevel | null) => {
    setLevel(next);
    setPage(1);
  };

  const contentCard = (card: ListeningCard) => {
    const minutes = formatDuration(card.durationMs);
    return (
      <Link
        key={card.id}
        to={`/practice/listening/${card.id}`}
        className="group bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-500/40 transition-all overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <div className="relative h-24 bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center overflow-hidden">
          {card.thumbnailUrl ? (
            <img
              src={card.thumbnailUrl}
              alt=""
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <Headphones size={30} className="text-white/90" aria-hidden="true" />
          )}
          <span className="absolute top-2 left-2 px-2 py-0.5 bg-white/90 dark:bg-slate-950/80 text-blue-600 dark:text-blue-300 text-[10px] font-black rounded-md uppercase">
            {card.level}
          </span>
        </div>
        <div className="p-4 space-y-1.5">
          <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100 leading-snug break-words group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {card.title}
          </p>
          {card.description && (
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 line-clamp-2">
              {card.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 pt-1">
            <span>{card.category.name}</span>
            <span className="inline-flex items-center gap-1">
              <ListOrdered size={12} aria-hidden="true" />
              {card.segmentCount} {t.practice.sentencesUnit}
            </span>
            {/* Duration is optional in the model, so it is rendered only when
                the author supplied one — never estimated. */}
            {minutes && (
              <span className="inline-flex items-center gap-1">
                <Clock size={12} aria-hidden="true" />
                {minutes} {t.lesson.minutesUnit}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {card.supportedModes.map((mode) => (
              <span
                key={mode}
                className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-bold rounded-md uppercase"
              >
                {mode === 'DICTATION'
                  ? t.practice.listeningModeDictation
                  : t.practice.listeningModeShadowing}
              </span>
            ))}
            <span className="ml-auto text-[11px] font-bold text-blue-600 dark:text-blue-400">
              {t.practice.listeningStartAction}
            </span>
          </div>
        </div>
      </Link>
    );
  };

  const categories = response?.categories ?? [];
  const items = response?.data ?? [];
  const totalPages = response?.meta.totalPages ?? 0;

  return (
    <StudentLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-[22px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
            {t.practice.listeningSection}
          </h1>
          <div className="h-1 w-12 bg-gradient-to-r from-blue-500 to-indigo-500 mt-2.5 rounded-full" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-3">
            {t.practice.listeningCatalogSubtitle}
          </p>
        </div>

        {/* Chips stay visible during loading and errors so the student can
            change or retry a filter without waiting for a response that may
            never arrive. They render from the LAST successful response, which
            is why they are absent on a first-load failure rather than invented. */}
        {categories.length > 0 && (
          <div className="space-y-3">
            <div role="group" aria-label={t.practice.allTopics} className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => selectCategory(null)}
                className={chipClass(categoryId === null)}
              >
                {t.practice.allTopics}
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => selectCategory(category.id)}
                  className={chipClass(categoryId === category.id)}
                >
                  {category.name} ({category.contentCount})
                </button>
              ))}
            </div>

            <div role="group" aria-label={t.practice.allLevels} className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => selectLevel(null)}
                className={chipClass(level === null)}
              >
                {t.practice.allLevels}
              </button>
              {LEVELS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => selectLevel(value)}
                  className={chipClass(level === value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        )}

        <section aria-labelledby="listening-catalog-heading" className="space-y-3">
          <h2
            id="listening-catalog-heading"
            className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide"
          >
            {t.practice.newLessons}
          </h2>

          {/* The four states are mutually exclusive and never blend. In
              particular an error is NEVER rendered as an empty catalog: "there
              is nothing to learn" and "we could not reach the server" are
              different facts, and only one of them is the student's problem. */}
          {loading ? (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              aria-busy="true"
              aria-label={t.common.loading}
            >
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-56 w-full" />
              ))}
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={() => void load()} />
          ) : items.length === 0 ? (
            <EmptyState icon={<Headphones size={32} />} message={t.practice.listeningEmptyCatalog} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map(contentCard)}
            </div>
          )}
        </section>

        {!loading && !error && totalPages > 1 && (
          <nav
            aria-label={t.practice.listeningPagination}
            className="flex items-center justify-center gap-3 text-xs font-bold"
          >
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:border-blue-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              {t.common.previous}
            </button>
            <span className="text-slate-400 dark:text-slate-500">
              {page}/{totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:border-blue-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              {t.common.next}
            </button>
          </nav>
        )}
      </div>
    </StudentLayout>
  );
};

export default ListeningCatalogPage;
