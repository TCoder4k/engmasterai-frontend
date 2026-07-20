import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import Modal from '../shared/Modal';
import { handleAuthError } from '../../services/apiError';
import {
  getManagedDeckWords,
  attachWords,
  detachWord,
} from '../../services/vocabDeckService';
import { getManagedWords } from '../../services/vocabWordService';
import { ManagedVocabDeckWordRow, ManagedVocabWordRow } from '../../types';
import { ArrowLeft, Plus, Trash2, Search } from 'lucide-react';

const AdminVocabDeckWords: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { deckId } = useParams<{ deckId: string }>();
  const state = location.state as { deckName?: string; libraryId?: string } | null;
  const deckName = state?.deckName;
  const libraryId = state?.libraryId;

  const [deckWords, setDeckWords] = useState<ManagedVocabDeckWordRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingWordId, setPendingWordId] = useState<string | null>(null);

  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [bankResults, setBankResults] = useState<ManagedVocabWordRow[]>([]);
  const [isBankLoading, setIsBankLoading] = useState(false);
  // Selection lives independently of the currently visible search results —
  // switching the search term must not silently drop what was already
  // checked (see the approved Phase 2 plan's attach-modal note).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAttaching, setIsAttaching] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attachResult, setAttachResult] = useState<{ attachedCount: number; skippedCount: number } | null>(null);

  const loadDeckWords = () => {
    if (!deckId) return;
    setIsLoading(true);
    setError(null);
    getManagedDeckWords(deckId)
      .then((res) => setDeckWords(res.data))
      .catch((err) => setError(handleAuthError(err, navigate)))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadDeckWords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  useEffect(() => {
    if (!isAttachOpen) return;
    setIsBankLoading(true);
    const timer = setTimeout(() => {
      getManagedWords({ limit: 50, search: bankSearch || undefined })
        .then((res) => setBankResults(res.data))
        .catch((err) => setAttachError(handleAuthError(err, navigate)))
        .finally(() => setIsBankLoading(false));
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAttachOpen, bankSearch]);

  const openAttach = () => {
    setSelectedIds(new Set());
    setBankSearch('');
    setAttachError(null);
    setAttachResult(null);
    setIsAttachOpen(true);
  };

  const toggleSelected = (wordId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(wordId)) next.delete(wordId);
      else next.add(wordId);
      return next;
    });
  };

  const submitAttach = async () => {
    if (!deckId || selectedIds.size === 0) return;
    setIsAttaching(true);
    setAttachError(null);
    setAttachResult(null);
    try {
      const result = await attachWords(deckId, Array.from(selectedIds));
      setAttachResult(result.data);
      setSelectedIds(new Set());
      loadDeckWords();
    } catch (err) {
      // Includes the backend's 400 when this would exceed the deck's
      // maximum size — surfaced as-is.
      setAttachError(handleAuthError(err, navigate));
    } finally {
      setIsAttaching(false);
    }
  };

  const handleDetach = async (row: ManagedVocabDeckWordRow) => {
    if (!deckId) return;
    if (!window.confirm(`Gỡ từ "${row.word.text}" khỏi bộ từ này?`)) return;
    setPendingWordId(row.word.id);
    setError(null);
    try {
      await detachWord(deckId, row.word.id);
      loadDeckWords();
    } catch (err) {
      // Includes the backend's 400 "unpublish first" message when this is
      // the last word of a published deck — surfaced as-is.
      setError(handleAuthError(err, navigate));
    } finally {
      setPendingWordId(null);
    }
  };

  const backHref = libraryId ? `/admin/vocab/libraries/${libraryId}/decks` : '/admin/vocab';

  return (
    <div className="min-h-screen flex bg-[#fbfcfd]">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AdminHeader />

        <main className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Link
                to={backHref}
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors mb-2"
              >
                <ArrowLeft size={14} />
                <span>Quay lại Bộ từ</span>
              </Link>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                {deckName ? `Từ vựng — ${deckName}` : 'Quản lý từ trong bộ từ'}
              </h1>
              <p className="text-sm text-slate-500 font-medium">
                {deckName ? 'Gắn hoặc gỡ từ khỏi bộ từ này.' : `Bộ từ ID: ${deckId}`}
              </p>
            </div>
            <button
              onClick={openAttach}
              className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all"
            >
              <Plus size={16} />
              <span>Gắn từ</span>
            </button>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium px-4 py-3 rounded-2xl">
              {error}
            </div>
          )}

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-16 text-center">#</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Từ</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nghĩa</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">CEFR</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoading && (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400 font-medium">
                        Đang tải...
                      </td>
                    </tr>
                  )}

                  {!isLoading && deckWords.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400 font-medium">
                        Chưa có từ nào. Bấm "Gắn từ" để thêm từ từ ngân hàng từ vựng.
                      </td>
                    </tr>
                  )}

                  {!isLoading && deckWords.map((row) => (
                    <tr key={row.word.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4 text-center text-xs text-slate-400">{row.orderIndex + 1}</td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">{row.word.text}</td>
                      <td className="px-6 py-4 text-sm text-slate-500 truncate max-w-xs">
                        {row.word.meanings[0]?.meaning || '—'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {row.word.cefrLevel ? (
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md uppercase">
                            {row.word.cefrLevel}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDetach(row)}
                          disabled={pendingWordId === row.word.id}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="Gỡ khỏi bộ từ"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {isAttachOpen && (
        <Modal title="Gắn từ từ Ngân hàng từ" onClose={() => setIsAttachOpen(false)}>
          <div className="space-y-4">
            {attachError && (
              <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm font-medium px-4 py-3 rounded-xl">
                {attachError}
              </div>
            )}
            {attachResult && (
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm font-medium px-4 py-3 rounded-xl">
                Đã gắn {attachResult.attachedCount} từ, bỏ qua {attachResult.skippedCount} từ đã có trong bộ từ.
              </div>
            )}

            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
              <input
                type="text"
                placeholder="Tìm từ trong ngân hàng..."
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/30 focus:border-indigo-300 dark:focus:border-indigo-500"
              />
            </div>

            <div className="max-h-72 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50">
              {isBankLoading && (
                <p className="text-center text-sm text-slate-400 font-medium py-6">Đang tìm...</p>
              )}
              {!isBankLoading && bankResults.length === 0 && (
                <p className="text-center text-sm text-slate-400 font-medium py-6">Không tìm thấy từ nào.</p>
              )}
              {!isBankLoading && bankResults.map((word) => (
                <label
                  key={word.id}
                  className="flex items-center space-x-3 px-4 py-2.5 hover:bg-slate-50/50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(word.id)}
                    onChange={() => toggleSelected(word.id)}
                    className="accent-indigo-600"
                  />
                  <span className="text-sm font-semibold text-slate-800">{word.text}</span>
                  {word.cefrLevel && (
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase">
                      {word.cefrLevel}
                    </span>
                  )}
                </label>
              ))}
            </div>

            <p className="text-xs font-semibold text-slate-500">{selectedIds.size} từ đã chọn</p>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAttachOpen(false)}
                className="px-4 py-2.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={submitAttach}
                disabled={isAttaching || selectedIds.size === 0}
                className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all disabled:opacity-60"
              >
                {isAttaching ? 'Đang gắn...' : `Gắn ${selectedIds.size || ''} từ`}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminVocabDeckWords;
