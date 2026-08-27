import React, { useEffect, useState } from 'react';
import { Search, Volume2, Pencil, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';
import { isTtsSupported, speakText } from '../../../services/tts';
import { handleAuthError } from '../../../services/apiError';
import {
  getPersonalVocabWords,
  PersonalVocabWord,
  PersonalWordStatusFilter,
  PersonalWordSort,
} from '../../../services/vocabPersonalService';
import { useNavigate } from 'react-router-dom';
import AddPersonalWordModal from './AddPersonalWordModal';
import { toggleSavedWord } from './saveWordAction';
import SaveWordStar from './SaveWordStar';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

const STATUS_BADGE: Record<PersonalVocabWord['state'], string> = {
  NEW: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
  LEARNING: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
  REVIEW: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
  RELEARNING: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
  MASTERED: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

const playWordAudio = (word: Pick<PersonalVocabWord, 'audioUrl' | 'text'>) => {
  if (word.audioUrl) {
    void new Audio(word.audioUrl).play().catch(() => {});
  } else {
    speakText(word.text);
  }
};

interface PersonalWordListTabProps {
  // Bumped by the parent (e.g. after Add/Import) to trigger a refetch
  // without this component needing to know why.
  refreshToken: number;
}

// "Danh sách" tab — a self-contained fetch/search/filter/sort/paginate list,
// the same self-fetching-widget shape TopStudentsWidget already established
// in this codebase. Deliberately its OWN GET /vocab-personal/words call
// (filtered + paginated) rather than sharing MyVocabularyPage's unfiltered
// fetch for the Flashcard/Dictation tabs — the two have different shapes and
// forcing one cache to serve both would couple this tab's pagination state
// to sessions that need "everything, unpaginated".
const PersonalWordListTab: React.FC<PersonalWordListTabProps> = ({ refreshToken }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [words, setWords] = useState<PersonalVocabWord[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: PAGE_SIZE, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<PersonalWordStatusFilter>('all');
  const [sort, setSort] = useState<PersonalWordSort>('newest');
  const [page, setPage] = useState(1);

  const [editingWord, setEditingWord] = useState<PersonalVocabWord | null>(null);
  const [busyWordIds, setBusyWordIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    let cancelled = false;
    getPersonalVocabWords({ page, limit: PAGE_SIZE, q: debouncedSearch || undefined, status, sort })
      .then((res) => {
        if (cancelled) return;
        setWords(res.data);
        setMeta(res.meta);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(handleAuthError(err, navigate) || t.myVocab.loadFailed);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, status, sort, refreshToken]);

  // Every row here is already saved — the star is always filled, and
  // unstarring it IS the delete action (same universal star, same shared
  // toggleSavedWord confirm+delete flow every other surface uses; this row
  // already knows its own PersonalVocabWord id directly, so no batch status
  // check is needed here at all).
  const handleUnsave = async (word: PersonalVocabWord) => {
    setBusyWordIds((prev) => new Set(prev).add(word.id));
    try {
      const result = await toggleSavedWord(
        { text: word.text, meaningVi: word.meaningVi },
        word.id,
        t.myVocab.confirmDelete,
      );
      if (result.action === 'unsaved') {
        setWords((prev) => prev.filter((w) => w.id !== word.id));
        setMeta((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
      }
    } catch (err) {
      setError(handleAuthError(err, navigate) || t.myVocab.deleteFailed);
    } finally {
      setBusyWordIds((prev) => {
        const next = new Set(prev);
        next.delete(word.id);
        return next;
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <label className="relative flex-1">
          <span className="sr-only">{t.myVocab.searchPlaceholder}</span>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t.myVocab.searchPlaceholder}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </label>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as PersonalWordStatusFilter);
            setPage(1);
          }}
          className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="all">{t.myVocab.filterAll}</option>
          <option value="new">{t.myVocab.filterNew}</option>
          <option value="learning">{t.myVocab.filterLearning}</option>
          <option value="mastered">{t.myVocab.filterMastered}</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as PersonalWordSort)}
          className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="newest">{t.myVocab.sortNewest}</option>
          <option value="oldest">{t.myVocab.sortOldest}</option>
          <option value="alphabetical">{t.myVocab.sortAlphabetical}</option>
        </select>
      </div>

      {isLoading && <p className="text-sm font-medium text-slate-400 dark:text-slate-500 py-6 text-center">{t.common.loading}</p>}
      {error && <p className="text-sm font-medium text-rose-500 py-2">{error}</p>}

      {!isLoading && !error && words.length === 0 && (
        <p className="text-sm font-medium text-slate-400 dark:text-slate-500 py-10 text-center">
          {meta.total === 0 && !debouncedSearch && status === 'all' ? t.myVocab.emptyList : t.myVocab.noResultsFound}
        </p>
      )}

      {!isLoading && words.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <th className="py-2 pr-3">{t.myVocab.columnWord}</th>
                <th className="py-2 pr-3">{t.myVocab.columnMeaning}</th>
                <th className="py-2 pr-3 hidden md:table-cell">{t.myVocab.columnTags}</th>
                <th className="py-2 pr-3">{t.myVocab.columnStatus}</th>
                <th className="py-2 pr-3 text-right">{t.myVocab.columnActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
              {words.map((word) => (
                <tr key={word.id}>
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      {(word.audioUrl || isTtsSupported()) && (
                        <button
                          type="button"
                          onClick={() => playWordAudio(word)}
                          aria-label={t.practice.playAudio}
                          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20"
                        >
                          <Volume2 size={13} aria-hidden="true" />
                        </button>
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{word.text}</p>
                        {word.ipa && <p className="text-xs font-mono text-slate-400 dark:text-slate-500">/{word.ipa}/</p>}
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 max-w-xs">
                    <p className="text-slate-700 dark:text-slate-200 truncate">{word.meaningVi}</p>
                  </td>
                  <td className="py-2.5 pr-3 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {word.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${STATUS_BADGE[word.state]}`}>
                      {word.state === 'MASTERED'
                        ? t.myVocab.filterMastered
                        : word.state === 'NEW'
                          ? t.myVocab.filterNew
                          : t.myVocab.filterLearning}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingWord(word)}
                        aria-label={t.myVocab.editWord}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 dark:hover:text-blue-400"
                      >
                        <Pencil size={14} />
                      </button>
                      <SaveWordStar
                        isSaved
                        isBusy={busyWordIds.has(word.id)}
                        onToggle={() => void handleUnsave(word)}
                        size={16}
                        className="p-1.5"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={meta.page <= 1}
            aria-label={t.common.previous}
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {meta.page} / {meta.totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            disabled={meta.page >= meta.totalPages}
            aria-label={t.common.next}
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {editingWord && (
        <AddPersonalWordModal
          editingWord={editingWord}
          onClose={() => setEditingWord(null)}
          onCreated={(updated) => {
            setWords((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
            setEditingWord(null);
          }}
        />
      )}
    </div>
  );
};

export default PersonalWordListTab;
