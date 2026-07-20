import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import Modal from '../shared/Modal';
import { handleAuthError } from '../../services/apiError';
import {
  getManagedWords,
  deleteWord,
  importWordsCsv,
} from '../../services/vocabWordService';
import { ManagedVocabWordRow, CefrLevel } from '../../types';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Upload,
  Volume2,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const CEFR_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const PAGE_LIMIT = 20;

const SAMPLE_CSV = `text,ipa,cefrLevel,partOfSpeech,meaning,example1,example1Translation,example2,example2Translation,synonyms,antonyms,collocations,wordFamily,audioUrl,imageUrl
hello,/heˈloʊ/,A1,INTERJECTION,a greeting,Hello there!,Xin chào!,,,,goodbye,,,,,
`;

const AdminVocabWords: React.FC = () => {
  const navigate = useNavigate();

  const [words, setWords] = useState<ManagedVocabWordRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [cefrFilter, setCefrFilter] = useState<CefrLevel | ''>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ createdCount: number; skippedCount: number } | null>(null);

  // Debounce the search box — a keystroke shouldn't fire a request per
  // character against the bank list.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadWords = () => {
    setIsLoading(true);
    setError(null);
    getManagedWords({ page, limit: PAGE_LIMIT, search: search || undefined, cefrLevel: cefrFilter || undefined })
      .then((res) => {
        setWords(res.data);
        setTotalPages(res.meta.totalPages);
      })
      .catch((err) => setError(handleAuthError(err, navigate)))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadWords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, cefrFilter]);

  const handleDelete = async (word: ManagedVocabWordRow) => {
    if (!window.confirm(`Xóa từ "${word.text}"?`)) return;
    setPendingActionId(word.id);
    setError(null);
    try {
      await deleteWord(word.id);
      loadWords();
    } catch (err) {
      // Includes the backend's 400 "detach from decks first" message when
      // the word is still attached somewhere — surfaced as-is.
      setError(handleAuthError(err, navigate));
    } finally {
      setPendingActionId(null);
    }
  };

  const openImport = () => {
    setImportFile(null);
    setImportError(null);
    setImportResult(null);
    setIsImportOpen(true);
  };

  const downloadSampleCsv = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vocab-words-sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const submitImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;
    setIsImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const result = await importWordsCsv(importFile);
      setImportResult(result.data);
      loadWords();
    } catch (err) {
      setImportError(handleAuthError(err, navigate));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#fbfcfd]">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AdminHeader />

        <main className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Ngân hàng từ (Word Bank)</h1>
              <p className="text-sm text-slate-500 font-medium">Kho từ vựng dùng chung cho mọi bộ từ và thư viện.</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={openImport}
                className="flex items-center space-x-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
              >
                <Upload size={16} />
                <span>Nhập CSV</span>
              </button>
              <Link
                to="/admin/vocab/words/new"
                className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all"
              >
                <Plus size={16} />
                <span>Thêm từ mới</span>
              </Link>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
              <input
                type="text"
                placeholder="Tìm theo từ..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
              />
            </div>
            <select
              value={cefrFilter}
              onChange={(e) => {
                setCefrFilter(e.target.value as CefrLevel | '');
                setPage(1);
              }}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
            >
              <option value="">Mọi cấp độ CEFR</option>
              {CEFR_LEVELS.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
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
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Từ</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">CEFR</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Nghĩa</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Media</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Dùng trong</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nguồn</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoading && (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400 font-medium">
                        Đang tải...
                      </td>
                    </tr>
                  )}

                  {!isLoading && words.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400 font-medium">
                        Không có từ nào phù hợp.
                      </td>
                    </tr>
                  )}

                  {!isLoading && words.map((word) => (
                    <tr key={word.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-900">{word.text}</p>
                        {word.ipa && <p className="text-[11px] text-slate-400">{word.ipa}</p>}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {word.cefrLevel ? (
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md uppercase">
                            {word.cefrLevel}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-slate-500">
                        {word._count.meanings}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center space-x-2">
                          <Volume2 size={14} className={word.audioUrl ? 'text-indigo-500' : 'text-slate-200'} />
                          <ImageIcon size={14} className={word.imageUrl ? 'text-indigo-500' : 'text-slate-200'} />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-slate-500">
                        {word._count.deckWords} bộ từ
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{word.source}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <Link
                            to={`/admin/vocab/words/${word.id}/edit`}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Chỉnh sửa"
                          >
                            <Pencil size={16} />
                          </Link>
                          <button
                            onClick={() => handleDelete(word)}
                            disabled={pendingActionId === word.id}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="Xóa"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!isLoading && totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-50">
                <span className="text-xs font-medium text-slate-400">Trang {page} / {totalPages}</span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {isImportOpen && (
        <Modal title="Nhập từ vựng từ CSV" onClose={() => setIsImportOpen(false)}>
          <form onSubmit={submitImport} className="space-y-4">
            {importError && (
              <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm font-medium px-4 py-3 rounded-xl whitespace-pre-wrap">
                {importError}
              </div>
            )}
            {importResult && (
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm font-medium px-4 py-3 rounded-xl">
                Đã tạo {importResult.createdCount} từ mới, bỏ qua {importResult.skippedCount} từ đã tồn tại.
              </div>
            )}
            <button
              type="button"
              onClick={downloadSampleCsv}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
            >
              Tải file mẫu (CSV)
            </button>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Chọn file CSV</label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="w-full text-sm"
              />
              <p className="text-[11px] text-slate-400 mt-1.5">
                Tối đa 2MB, 1000 dòng. Từ đã tồn tại (không phân biệt hoa/thường) sẽ được bỏ qua.
              </p>
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsImportOpen(false)}
                className="px-4 py-2.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={isImporting || !importFile}
                className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all disabled:opacity-60"
              >
                {isImporting ? 'Đang nhập...' : 'Nhập file'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default AdminVocabWords;
