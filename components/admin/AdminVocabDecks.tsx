import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import Modal from '../shared/Modal';
import { handleAuthError } from '../../services/apiError';
import {
  getManagedDecksByLibrary,
  createDeck,
  updateDeck,
  publishDeck,
  unpublishDeck,
  deleteDeck,
} from '../../services/vocabDeckService';
import { ManagedVocabDeck, CefrLevel } from '../../types';
import { Plus, Pencil, Trash2, Eye, EyeOff, ArrowLeft } from 'lucide-react';

const CEFR_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

interface DeckFormState {
  name: string;
  description: string;
  thumbnail: string;
  cefrLevel: CefrLevel | '';
}

const emptyForm: DeckFormState = { name: '', description: '', thumbnail: '', cefrLevel: '' };

const AdminVocabDecks: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { libraryId } = useParams<{ libraryId: string }>();
  // Best-effort name from the library row's navigate state — there is no
  // admin single-library GET and GET /vocab/libraries/:id 404s drafts, so on
  // a hard refresh (state lost) we fall back to showing the libraryId for
  // context instead of scanning the paginated manage-libraries list.
  const libraryName = (location.state as { libraryName?: string } | null)?.libraryName;

  const [decks, setDecks] = useState<ManagedVocabDeck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingDeck, setEditingDeck] = useState<ManagedVocabDeck | null>(null);
  const [form, setForm] = useState<DeckFormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const loadDecks = () => {
    if (!libraryId) return;
    setIsLoading(true);
    setError(null);
    getManagedDecksByLibrary(libraryId)
      .then((res) => setDecks(res.data))
      .catch((err) => setError(handleAuthError(err, navigate)))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadDecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryId]);

  const openCreate = () => {
    setForm(emptyForm);
    setFormError(null);
    setIsCreateOpen(true);
  };

  const openEdit = (deck: ManagedVocabDeck) => {
    setEditingDeck(deck);
    setForm({
      name: deck.name,
      description: deck.description || '',
      thumbnail: deck.thumbnail || '',
      cefrLevel: deck.cefrLevel || '',
    });
    setFormError(null);
  };

  const closeModals = () => {
    setIsCreateOpen(false);
    setEditingDeck(null);
  };

  const toDto = (f: DeckFormState) => ({
    name: f.name,
    description: f.description || undefined,
    thumbnail: f.thumbnail || undefined,
    cefrLevel: f.cefrLevel || undefined,
  });

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!libraryId) return;
    setIsSaving(true);
    setFormError(null);
    try {
      await createDeck(libraryId, toDto(form));
      closeModals();
      loadDecks();
    } catch (err) {
      setFormError(handleAuthError(err, navigate));
    } finally {
      setIsSaving(false);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDeck) return;
    setIsSaving(true);
    setFormError(null);
    try {
      await updateDeck(editingDeck.id, toDto(form));
      closeModals();
      loadDecks();
    } catch (err) {
      setFormError(handleAuthError(err, navigate));
    } finally {
      setIsSaving(false);
    }
  };

  const togglePublish = async (deck: ManagedVocabDeck) => {
    setPendingActionId(deck.id);
    setError(null);
    try {
      if (deck.isPublished) {
        await unpublishDeck(deck.id);
      } else {
        // Phase 1: no content guard yet, so this always succeeds even with
        // zero words attached (see Phase 1 plan's Handoff #2).
        await publishDeck(deck.id);
      }
      loadDecks();
    } catch (err) {
      setError(handleAuthError(err, navigate));
    } finally {
      setPendingActionId(null);
    }
  };

  const handleDelete = async (deck: ManagedVocabDeck) => {
    if (!window.confirm(`Xóa bộ từ "${deck.name}"?`)) return;
    setPendingActionId(deck.id);
    setError(null);
    try {
      await deleteDeck(deck.id);
      loadDecks();
    } catch (err) {
      // Includes the backend's 400 "unpublish first" message when the deck
      // is still published.
      setError(handleAuthError(err, navigate));
    } finally {
      setPendingActionId(null);
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
              <Link
                to="/admin/vocab"
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors mb-2"
              >
                <ArrowLeft size={14} />
                <span>Quay lại Từ vựng</span>
              </Link>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                {libraryName ? `Bộ từ — ${libraryName}` : 'Bộ từ (Deck)'}
              </h1>
              {/* On a hard refresh the router state (libraryName) is lost and
                  there's no admin single-library GET to recover it, so fall
                  back to showing the libraryId for context. */}
              <p className="text-sm text-slate-500 font-medium">
                {libraryName
                  ? 'Sắp xếp theo thứ tự hiển thị (orderIndex).'
                  : `Thư viện ID: ${libraryId} · sắp xếp theo orderIndex.`}
              </p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all"
            >
              <Plus size={16} />
              <span>Thêm bộ từ</span>
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
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bộ từ</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">CEFR</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trạng thái</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoading && (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-400 font-medium">
                        Đang tải...
                      </td>
                    </tr>
                  )}

                  {!isLoading && decks.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-400 font-medium">
                        Chưa có bộ từ nào. Bấm "Thêm bộ từ" để bắt đầu.
                      </td>
                    </tr>
                  )}

                  {!isLoading && decks.map((deck) => (
                    <tr key={deck.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-900 truncate max-w-xs">{deck.name}</p>
                        {deck.description && (
                          <p className="text-[11px] text-slate-400 truncate max-w-xs">{deck.description}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {deck.cefrLevel ? (
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md uppercase">
                            {deck.cefrLevel}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => togglePublish(deck)}
                          disabled={pendingActionId === deck.id}
                          className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                            deck.isPublished ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                          } hover:opacity-70`}
                        >
                          {deck.isPublished ? <Eye size={12} /> : <EyeOff size={12} />}
                          <span>
                            {pendingActionId === deck.id ? '...' : deck.isPublished ? 'Công khai' : 'Bản nháp'}
                          </span>
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => openEdit(deck)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Chỉnh sửa"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(deck)}
                            disabled={pendingActionId === deck.id}
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
          </div>
        </main>
      </div>

      {(isCreateOpen || editingDeck) && (
        <Modal
          title={editingDeck ? `Chỉnh sửa: ${editingDeck.name}` : 'Thêm bộ từ mới'}
          onClose={closeModals}
        >
          <form onSubmit={editingDeck ? submitEdit : submitCreate} className="space-y-4">
            {formError && (
              <div className="bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium px-4 py-3 rounded-xl">
                {formError}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Tên bộ từ</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Mô tả (tùy chọn)</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Cấp độ CEFR (tùy chọn)</label>
              <select
                value={form.cefrLevel}
                onChange={(e) => setForm((f) => ({ ...f, cefrLevel: e.target.value as CefrLevel | '' }))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
              >
                <option value="">— Không chọn —</option>
                {CEFR_LEVELS.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Thumbnail URL (tùy chọn)</label>
              <input
                type="text"
                value={form.thumbnail}
                onChange={(e) => setForm((f) => ({ ...f, thumbnail: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
              />
            </div>
            <p className="text-[11px] text-slate-400 -mt-2">
              Chưa có từ vựng nào trong bộ từ này (tính năng thêm từ sẽ có ở giai đoạn tiếp theo) — bộ từ vẫn có thể xuất bản, nhưng sẽ trống cho đến khi có từ.
            </p>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={closeModals}
                className="px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all disabled:opacity-60"
              >
                {isSaving ? 'Đang lưu...' : editingDeck ? 'Lưu thay đổi' : 'Thêm bộ từ'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default AdminVocabDecks;
