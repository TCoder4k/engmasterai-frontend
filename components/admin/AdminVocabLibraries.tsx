import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import Modal from '../shared/Modal';
import { handleAuthError } from '../../services/apiError';
import {
  getManagedLibraries,
  createLibrary,
  updateLibrary,
  publishLibrary,
  unpublishLibrary,
  deleteLibrary,
} from '../../services/vocabLibraryService';
import { ManagedVocabLibrary } from '../../types';
import { Plus, Pencil, Trash2, Eye, EyeOff, Library as LibraryIcon, Layers } from 'lucide-react';

interface LibraryFormState {
  name: string;
  description: string;
  thumbnail: string;
}

const emptyForm: LibraryFormState = { name: '', description: '', thumbnail: '' };

const AdminVocabLibraries: React.FC = () => {
  const navigate = useNavigate();

  const [libraries, setLibraries] = useState<ManagedVocabLibrary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingLibrary, setEditingLibrary] = useState<ManagedVocabLibrary | null>(null);
  const [form, setForm] = useState<LibraryFormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const loadLibraries = () => {
    setIsLoading(true);
    setError(null);
    getManagedLibraries(1, 100)
      .then((res) => setLibraries(res.data))
      .catch((err) => setError(handleAuthError(err, navigate)))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadLibraries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setFormError(null);
    setIsCreateOpen(true);
  };

  const openEdit = (library: ManagedVocabLibrary) => {
    setEditingLibrary(library);
    setForm({
      name: library.name,
      description: library.description,
      thumbnail: library.thumbnail || '',
    });
    setFormError(null);
  };

  const closeModals = () => {
    setIsCreateOpen(false);
    setEditingLibrary(null);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError(null);
    try {
      await createLibrary({
        name: form.name,
        description: form.description,
        thumbnail: form.thumbnail || undefined,
      });
      closeModals();
      loadLibraries();
    } catch (err) {
      setFormError(handleAuthError(err, navigate));
    } finally {
      setIsSaving(false);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLibrary) return;
    setIsSaving(true);
    setFormError(null);
    try {
      await updateLibrary(editingLibrary.id, {
        name: form.name,
        description: form.description,
        thumbnail: form.thumbnail || undefined,
      });
      closeModals();
      loadLibraries();
    } catch (err) {
      setFormError(handleAuthError(err, navigate));
    } finally {
      setIsSaving(false);
    }
  };

  const togglePublish = async (library: ManagedVocabLibrary) => {
    setPendingActionId(library.id);
    setError(null);
    try {
      if (library.isPublished) {
        await unpublishLibrary(library.id);
      } else {
        await publishLibrary(library.id);
      }
      loadLibraries();
    } catch (err) {
      setError(handleAuthError(err, navigate));
    } finally {
      setPendingActionId(null);
    }
  };

  const handleDelete = async (library: ManagedVocabLibrary) => {
    if (!window.confirm(`Xóa thư viện "${library.name}"?`)) return;
    setPendingActionId(library.id);
    setError(null);
    try {
      await deleteLibrary(library.id);
      loadLibraries();
    } catch (err) {
      // Includes the backend's 400 "remove decks first" message when the
      // library still has decks — surfaced as-is, not swallowed.
      setError(handleAuthError(err, navigate));
    } finally {
      setPendingActionId(null);
    }
  };

  const goToDecks = (library: ManagedVocabLibrary) => {
    navigate(`/admin/vocab/libraries/${library.id}/decks`, { state: { libraryName: library.name } });
  };

  return (
    <div className="min-h-screen flex bg-[#fbfcfd]">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AdminHeader />

        <main className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Từ vựng (Vocabulary)</h1>
              <p className="text-sm text-slate-500 font-medium">Quản lý thư viện từ vựng (TOEIC, IELTS, Business English...).</p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all"
            >
              <Plus size={16} />
              <span>Tạo thư viện</span>
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
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Thư viện</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Bộ từ (Deck)</th>
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

                  {!isLoading && libraries.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-400 font-medium">
                        Chưa có thư viện nào. Bấm "Tạo thư viện" để bắt đầu.
                      </td>
                    </tr>
                  )}

                  {!isLoading && libraries.map((library) => (
                    <tr key={library.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 overflow-hidden">
                            {library.thumbnail ? (
                              <img src={library.thumbnail} className="w-full h-full object-cover" alt="" />
                            ) : (
                              <LibraryIcon size={20} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate max-w-xs">{library.name}</p>
                            <p className="text-[11px] text-slate-400 truncate max-w-xs">{library.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => goToDecks(library)}
                          title="Quản lý bộ từ"
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          {library._count.decks} bộ từ
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => togglePublish(library)}
                          disabled={pendingActionId === library.id}
                          className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                            library.isPublished ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                          } hover:opacity-70`}
                        >
                          {library.isPublished ? <Eye size={12} /> : <EyeOff size={12} />}
                          <span>
                            {pendingActionId === library.id ? '...' : library.isPublished ? 'Công khai' : 'Bản nháp'}
                          </span>
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => goToDecks(library)}
                            className="inline-flex items-center space-x-1.5 px-3 py-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all text-xs font-bold"
                            title="Quản lý bộ từ"
                          >
                            <Layers size={16} />
                            <span className="hidden sm:inline">Quản lý bộ từ</span>
                          </button>
                          <button
                            onClick={() => openEdit(library)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Chỉnh sửa"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(library)}
                            disabled={pendingActionId === library.id}
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

      {(isCreateOpen || editingLibrary) && (
        <Modal
          title={editingLibrary ? `Chỉnh sửa: ${editingLibrary.name}` : 'Tạo thư viện mới'}
          onClose={closeModals}
        >
          <form onSubmit={editingLibrary ? submitEdit : submitCreate} className="space-y-4">
            {formError && (
              <div className="bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium px-4 py-3 rounded-xl">
                {formError}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Tên thư viện</label>
              <input
                type="text"
                required
                placeholder="TOEIC, IELTS, Business English..."
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Mô tả</label>
              <textarea
                required
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
              />
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
                {isSaving ? 'Đang lưu...' : editingLibrary ? 'Lưu thay đổi' : 'Tạo thư viện'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default AdminVocabLibraries;
