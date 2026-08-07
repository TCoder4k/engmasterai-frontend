import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  Flame,
  Hash,
  Headphones,
  ListOrdered,
  Mic,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import StudentLayout from '../../user/StudentLayout';
import EmptyState from '../../shared/EmptyState';
import ErrorState from '../../shared/ErrorState';
import Skeleton from '../../shared/Skeleton';
import { useTranslation } from '../../../i18n/useTranslation';
import { CefrLevel } from '../../../types';
import { PATH_BY_MODE } from './ListeningContentPage';
import {
  getListeningCatalog,
  getListeningProgress,
  getListeningShadowingProgress,
  ListeningCard,
  ListeningCatalogResponse,
  ListeningMode,
} from '../../../services/listeningService';

// /practice/listening AND /practice/shadowing — ONE catalog implementation,
// two sidebar entries. Restyled in Sprint 11 to match
// `ai-studio-dashboard-reference`'s Parroto-style catalog (hero banner,
// hashtag-style topic pills, search, level filter, per-topic sections), with
// every number on the page coming from the SAME server response the old,
// plainer version used — nothing here is mock data or a hardcoded catalog
// figure. See ListeningContentPage.tsx for the reasoning that is unchanged
// from Sprint 11 Phase 2 (server-driven, no client-side visibility filtering,
// filters are server queries).
//
// WHY ONE COMPONENT, NOT TWO. Dictation and Shadowing are the same recordings,
// the same categories, the same thumbnails and the same query plumbing — only
// three things differ: which mode the catalog is filtered to, which batch
// progress endpoint is read, and which mode's status the card footer shows.
// `mode` is the one prop that captures all three; ShadowingCatalogPage.tsx is
// a five-line wrapper that sets it.
//
// THE CARD FOOTER SHOWS EXACTLY ONE MODE'S STATUS, NOT BOTH — a deliberate
// difference from the reference image, which always shows a Dictation row and
// a Shadowing row side by side. Filtering the catalog itself by `mode` (the
// API already supports the parameter) means every card on THIS page supports
// THIS page's mode, so showing only that one status is both what was asked
// for and never a lie by omission.

const PAGE_SIZE = 12;
const LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
/** How many cards an unfiltered topic section shows before "View all". */
const SECTION_PREVIEW_SIZE = 4;
/** A keystroke must not fire a request per character — same debounce AdminVocabWords uses. */
const SEARCH_DEBOUNCE_MS = 400;

const formatDuration = (durationMs: number | null): string | null => {
  if (!durationMs || durationMs <= 0) return null;
  const totalMinutes = Math.round(durationMs / 60000);
  return totalMinutes < 1 ? '<1' : String(totalMinutes);
};

/**
 * Dictation's and Shadowing's per-content summaries are structurally
 * identical (see ListeningDictationSummary / ListeningShadowingSummary) —
 * this is that shared shape, so the card renderer does not need to know which
 * mode it is looking at.
 */
interface ModeSummary {
  totalSegments: number;
  completedSegments: number;
  completed: boolean;
}

interface ListeningCatalogPageProps {
  /** Defaults to DICTATION — the identity of /practice/listening's own route. */
  mode?: ListeningMode;
}

const ListeningCatalogPage: React.FC<ListeningCatalogPageProps> = ({
  mode = 'DICTATION',
}) => {
  const { t } = useTranslation();
  const isShadowing = mode === 'SHADOWING';

  const [response, setResponse] = useState<ListeningCatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keyed by contentId. Absent = not started; null map = progress could not
  // be loaded, so no status is drawn anywhere — never a fabricated "not
  // started" for a recording the student may well have finished.
  const [progress, setProgress] = useState<Map<string, ModeSummary> | null>(null);

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [level, setLevel] = useState<CefrLevel | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getListeningCatalog({
        categoryId: categoryId ?? undefined,
        level: level ?? undefined,
        mode,
        q: search || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setResponse(data);

      // Sprint 11 Phase 4A/4B. Deliberately AFTER the catalog resolved and in
      // its own try: a progress failure must not blank the grid.
      try {
        const ids = data.data.map((card) => card.id);
        if (isShadowing) {
          const rows = await getListeningShadowingProgress(ids);
          setProgress(
            new Map(
              rows
                .filter((row) => row.shadowing !== null)
                .map((row) => [row.contentId, row.shadowing!]),
            ),
          );
        } else {
          const rows = await getListeningProgress(ids);
          setProgress(
            new Map(
              rows
                .filter((row) => row.dictation !== null)
                .map((row) => [row.contentId, row.dictation!]),
            ),
          );
        }
      } catch {
        // No status rather than a wrong one. The catalog still works.
        setProgress(null);
      }
    } catch (caught) {
      // The previous response is dropped on purpose — stale cards under an
      // error banner could be content that has since been unpublished.
      setResponse(null);
      setProgress(null);
      setError(caught instanceof Error ? caught.message : t.practice.listeningLoadError);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, level, mode, search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const pillClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
      active
        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow'
        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
    }`;

  const levelPillClass = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
      active
        ? 'bg-blue-600 text-white shadow'
        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
    }`;

  const selectCategory = (next: string | null) => {
    setCategoryId(next);
    setPage(1);
  };

  const selectLevel = (next: CefrLevel | null) => {
    setLevel(next);
    setPage(1);
  };

  const categories = response?.categories ?? [];
  const items = response?.data ?? [];
  const totalPages = response?.meta.totalPages ?? 0;
  const activeCategory = categories.find((c) => c.id === categoryId) ?? null;
  const isFiltered = Boolean(categoryId || search);

  // Group the CURRENT PAGE into topic sections for the overview presentation
  // — no second fetch, no client-side filtering of a larger set. This is the
  // same bounded page the old page already showed under one "New lessons"
  // heading; grouping it by `card.category` is a presentational change to
  // data already on screen, not a new query pattern. It only applies with no
  // filter and no search active — the moment either is set, there is exactly
  // one topic (or one search intent) in play and a flat, paginated grid is
  // the honest presentation.
  const overviewSections = useMemo(() => {
    if (isFiltered) return null;
    const order: string[] = [];
    const byCategory = new Map<string, { name: string; items: ListeningCard[] }>();
    for (const card of items) {
      if (!byCategory.has(card.category.id)) {
        order.push(card.category.id);
        byCategory.set(card.category.id, { name: card.category.name, items: [] });
      }
      byCategory.get(card.category.id)!.items.push(card);
    }
    return order.map((id) => ({ id, ...byCategory.get(id)! }));
  }, [items, isFiltered]);

  const ModeIcon = isShadowing ? Mic : Headphones;

  const cardHref = (card: ListeningCard) =>
    isShadowing
      ? `/practice/listening/${card.id}/${PATH_BY_MODE.SHADOWING}`
      : `/practice/listening/${card.id}`;

  const modeStatusLabel = isShadowing
    ? t.practice.listeningModeShadowing
    : t.practice.listeningModeDictation;

  const renderCard = (card: ListeningCard) => {
    const minutes = formatDuration(card.durationMs);
    const summary = progress?.get(card.id) ?? null;
    const started = Boolean(summary && summary.totalSegments > 0 && summary.completedSegments > 0);

    return (
      <Link
        key={card.id}
        to={cardHref(card)}
        className="group relative bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-500/40 hover:-translate-y-0.5 transition-all flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <div className="relative aspect-video w-full bg-gradient-to-tr from-blue-500 to-indigo-500 overflow-hidden">
          {card.thumbnailUrl ? (
            <img
              src={card.thumbnailUrl}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <ModeIcon size={30} className="text-white/90" aria-hidden="true" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

          <span className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-white/95 dark:bg-slate-950/90 text-blue-700 dark:text-blue-300 text-[10px] font-black rounded-md uppercase">
            {card.level}
          </span>

          {minutes && (
            <span className="absolute top-2.5 right-2.5 px-2 py-0.5 bg-black/70 text-white text-[10px] font-mono font-bold rounded-md flex items-center gap-1">
              <Clock size={11} aria-hidden="true" />
              {minutes} {t.lesson.minutesUnit}
            </span>
          )}

          {/* Decorative only — the whole card is already the one interactive
              element, so this is never a second, nested control. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <span className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm border border-white/40 flex items-center justify-center">
              <ModeIcon size={20} className="text-white" />
            </span>
          </div>

          {card.sourceName && (
            <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 bg-black/70 text-white text-[10px] font-bold rounded-md truncate max-w-[70%]">
              {card.sourceName}
            </span>
          )}
        </div>

        <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
          <div className="space-y-1">
            <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100 leading-snug break-words line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {card.title}
            </p>
            {card.description && (
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 line-clamp-2">
                {card.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 pt-0.5">
              <span>{card.category.name}</span>
              <span className="inline-flex items-center gap-1">
                <ListOrdered size={12} aria-hidden="true" />
                {card.segmentCount} {t.practice.sentencesUnit}
              </span>
            </div>
          </div>

          {started && summary && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-500 dark:text-slate-400">{modeStatusLabel}</span>
                <span
                  className={
                    summary.completed
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-blue-600 dark:text-blue-400'
                  }
                >
                  {summary.completed
                    ? t.practice.listeningCompletedLabel
                    : `${summary.completedSegments}/${summary.totalSegments}`}
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={summary.totalSegments}
                aria-valuenow={summary.completedSegments}
                aria-label={modeStatusLabel}
                className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
              >
                <div
                  className={`h-full rounded-full ${
                    summary.completed ? 'bg-emerald-500' : 'bg-blue-500'
                  }`}
                  style={{
                    width: `${Math.round(
                      (summary.completedSegments / summary.totalSegments) * 100,
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-bold">
            <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <ModeIcon size={13} aria-hidden="true" />
              {modeStatusLabel}
            </span>
            <span className="text-blue-600 dark:text-blue-400">
              {t.practice.listeningStartAction}
            </span>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <StudentLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* ============ Hero banner ============ */}
        <div className="rounded-[28px] border border-slate-800 bg-[#0A1020] px-4 py-4 shadow-[0_12px_35px_rgba(0,0,0,0.35)] sm:px-6 sm:py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/15 text-cyan-400">
                <div className="grid grid-cols-2 gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm border border-current" aria-hidden="true" />
                  <span className="h-2.5 w-2.5 rounded-sm border border-current" aria-hidden="true" />
                  <span className="h-2.5 w-2.5 rounded-sm border border-current" aria-hidden="true" />
                  <span className="h-2.5 w-2.5 rounded-sm border border-current" aria-hidden="true" />
                </div>
              </div>

              <div className="min-w-0 space-y-0.5">
                <h1 className="truncate text-lg font-extrabold leading-tight text-white sm:text-xl">
                  {t.practice.catalogHeroTitle}
                </h1>
                <p className="truncate text-sm text-slate-400 sm:text-[15px]">
                  {t.practice.catalogHeroSubtitle}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Link
                to="/practice/listening"
                className={`inline-flex min-h-[42px] items-center justify-center gap-2 rounded-2xl border px-5 py-2.5 text-sm font-bold transition-colors sm:min-w-[238px] ${
                  !isShadowing
                    ? 'border-cyan-500/30 bg-[#0E1730] text-cyan-400'
                    : 'border-slate-700 bg-[#0B1326] text-slate-200 hover:border-slate-600 hover:bg-[#101A37]'
                }`}
              >
                <Headphones size={18} aria-hidden="true" />
                <span>{t.practice.listeningModeDictation}</span>
              </Link>

              <Link
                to="/practice/shadowing"
                className={`inline-flex min-h-[42px] items-center justify-center gap-2 rounded-2xl border px-5 py-2.5 text-sm font-bold transition-colors sm:min-w-[210px] ${
                  isShadowing
                    ? 'border-violet-500/30 bg-[#0E1730] text-violet-400'
                    : 'border-slate-700 bg-[#0B1326] text-slate-200 hover:border-slate-600 hover:bg-[#101A37]'
                }`}
              >
                <Mic size={18} aria-hidden="true" />
                <span>{t.practice.listeningModeShadowing}</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ============ Topic ("hashtag") pills ============ */}
        {categories.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-2">
                <Flame size={15} className="text-rose-500" aria-hidden="true" />
                {t.practice.catalogHotTopics}
              </span>
              {activeCategory && (
                <button
                  type="button"
                  onClick={() => selectCategory(null)}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {t.practice.catalogClearFilter}: #{activeCategory.name}
                </button>
              )}
            </div>

            <div
              role="group"
              aria-label={t.practice.allTopics}
              className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar"
            >
              <button type="button" onClick={() => selectCategory(null)} className={pillClass(categoryId === null)}>
                {t.practice.allTopics}
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => selectCategory(category.id)}
                  className={pillClass(categoryId === category.id)}
                >
                  <Hash size={12} aria-hidden="true" />
                  {category.name} ({category.contentCount})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ============ Search + level filter bar ============ */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="relative flex-1 min-w-[240px]">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t.practice.catalogSearchPlaceholder}
              aria-label={t.practice.catalogSearchPlaceholder}
              className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                aria-label={t.practice.catalogClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div
            role="group"
            aria-label={t.practice.allLevels}
            className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto"
          >
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 px-2 flex items-center gap-1 shrink-0">
              <SlidersHorizontal size={13} className="text-blue-500" aria-hidden="true" />
              <span className="hidden sm:inline">{t.practice.catalogLevelLabel}</span>
            </span>
            <button type="button" onClick={() => selectLevel(null)} className={levelPillClass(level === null)}>
              {t.practice.allLevels}
            </button>
            {LEVELS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => selectLevel(value)}
                className={levelPillClass(level === value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        {/* ============ Results ============ */}
        <section
          aria-labelledby="listening-catalog-heading"
          className="space-y-3"
        >
          {loading ? (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
              aria-busy="true"
              aria-label={t.common.loading}
            >
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-64 w-full" />
              ))}
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={() => void load()} />
          ) : items.length === 0 ? (
            search || categoryId || level ? (
              <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl space-y-3">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  {t.practice.catalogNoResultsTitle}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {t.practice.catalogNoResultsHint}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    setSearch('');
                    setCategoryId(null);
                    setLevel(null);
                    setPage(1);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-extrabold rounded-xl shadow hover:bg-blue-700 transition-colors"
                >
                  {t.practice.catalogResetFilters}
                </button>
              </div>
            ) : (
              <EmptyState icon={<ModeIcon size={32} />} message={t.practice.listeningEmptyCatalog} />
            )
          ) : overviewSections ? (
            <div className="space-y-10">
              {overviewSections.map((section) => {
                const total =
                  categories.find((c) => c.id === section.id)?.contentCount ?? section.items.length;
                const preview = section.items.slice(0, SECTION_PREVIEW_SIZE);
                return (
                  <div key={section.id} className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="w-1.5 h-6 rounded-full bg-gradient-to-b from-blue-500 to-indigo-500" aria-hidden="true" />
                        <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100">
                          {section.name}
                          <span className="ml-2 text-xs font-bold text-slate-400">({total})</span>
                        </h2>
                      </div>
                      {total > preview.length && (
                        <button
                          type="button"
                          onClick={() => selectCategory(section.id)}
                          className="text-xs font-extrabold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                        >
                          {t.practice.catalogViewAll}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {preview.map(renderCard)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <h2
                id="listening-catalog-heading"
                className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide"
              >
                {search ? t.practice.catalogSearchResultsTitle : t.practice.newLessons}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {items.map(renderCard)}
              </div>
            </>
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
