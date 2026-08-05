import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import Modal from '../shared/Modal';
import { handleAuthError } from '../../services/apiError';
import {
  ManagedListeningCategory,
  createListeningCategory,
  deleteListeningCategory,
  getListeningCategories,
  publishListeningCategory,
  unpublishListeningCategory,
  updateListeningCategory,
} from '../../services/listeningAdminService';
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Headphones,
  Layers,
  AlertTriangle,
} from 'lucide-react';

// Sprint 11 — /admin/listening/categories.
//
// A category is a CONTAINER WITH A KILL SWITCH: unpublishing one removes every
// recording underneath it from the student surface at once, because visibility
// is evaluated at both levels server-side. The row copy says so explicitly —
// an admin who thinks this only hides a label will eventually pull a topic in
// production and be surprised.
//
// Vietnamese strings are hardcoded, and the layout is light-only. That is the
// existing admin convention, not an oversight: none of the twelve admin pages
// uses useTranslation, and AdminHeader states plainly that "the admin layout
// has no dark mode". Introducing i18n or dark mode for these three pages alone
// would make them the only exception in the surface.

interface CategoryFormState {
  name: string;
  nameVi: string;
}

const emptyForm: CategoryFormState = { name: '', nameVi: '' };

const AdminListeningCategories: React.FC = () => {
  const navigate = useNavigate();

  const [categories, setCategories] = useState<ManagedListeningCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedListeningCategory | null>(null);
  const [form, setForm] = useState<CategoryFormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const loadCategories = () => {
    setIsLoading(true);
    setError(null);
    getListeningCategories()
      .then(setCategories)
      .catch((err) => setError(handleAuthError(err, navigate)))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setFormError(null);
    setIsCreateOpen(true);
  };

  const openEdit = (category: ManagedListeningCategory) => {
    setEditing(category);
    setForm({ name: category.name, nameVi: category.nameVi });
    setFormError(null);
  };

  const closeModals = () => {
    setIsCreateOpen(false);
    setEditing(null);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError(null);
    try {
      await createListeningCategory({ name: form.name, nameVi: form.nameVi });
      closeModals();
      loadCategories();
    } catch (err) {
      setFormError(handleAuthError(err, navigate));
    } finally {
      setIsSaving(false);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setIsSaving(true);
    setFormError(null);
    try {
      await updateListeningCategory(editing.id, {
        name: form.name,
        nameVi: form.nameVi,
      });
      closeModals();
      loadCategories();
    } catch (err) {
      setFormError(handleAuthError(err, navigate));
    } finally {
      setIsSaving(false);
    }
  };

  const togglePublish = async (category: ManagedListeningCategory) => {
    // Unpublishing a category with published recordings under it is allowed —
    // it is the intended way to pull a whole topic — but the admin should know
    // what they are doing before it happens.
    if (category.isPublished && category.contentCount > 0) {
      const confirmed = window.confirm(
        `Gỡ xuất bản "${category.name}" sẽ ẩn TẤT CẢ ${category.contentCount} nội dung bên trong khỏi học viên ngay lập tức.\n\n` +
          'Trạng thái xuất bản của từng nội dung được giữ nguyên, nên xuất bản lại danh mục sẽ khôi phục đúng như cũ.\n\nTiếp tục?',
      );
      if (!confirmed) return;
    }

    setPendingActionId(category.id);
    setError(null);
    try {
      if (category.isPublished) {
        await unpublishListeningCategory(category.id);
      } else {
        await publishListeningCategory(category.id);
      }
      loadCategories();
    } catch (err) {
      setError(handleAuthError(err, navigate));
    } finally {
      setPendingActionId(null);
    }
  };

  const remove = async (category: ManagedListeningCategory) => {
    if (
      !window.confirm(
        `Xóa danh mục "${category.name}"? Hành động này không thể hoàn tác.`,
      )
    ) {
      return;
    }

    setPendingActionId(category.id);
    setError(null);
    try {
      await deleteListeningCategory(category.id);
      loadCategories();
    } catch (err) {
      // The backend refuses (400) while the category still holds content.
      // Its message names the reason; show it rather than a generic failure.
      setError(handleAuthError(err, navigate));
    } finally {
      setPendingActionId(null);
    }
  };

  const formFields = (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1.5">
          Tên danh mục (tiếng Anh)
        </label>
        <input
          type="text"
          required
          maxLength={80}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Business"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1.5">
          Tên danh mục (tiếng Việt)
        </label>
        <input
          type="text"
          required
          maxLength={80}
          value={form.nameVi}
          onChange={(e) => setForm({ ...form, nameVi: e.target.value })}
          placeholder="Kinh doanh"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
        />
        <p className="text-[11px] text-slate-400 mt-1">
          Bắt buộc — giao diện học viên hiển thị song ngữ.
        </p>
      </div>
      {formError && (
        <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
          {formError}
        </p>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar />
      <div className="flex-1 min-w-0">
        <AdminHeader />
        <main className="p-8 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-black text-slate-900">
                Danh mục Listening
              </h1>
              <p className="text-xs font-medium text-slate-500 mt-1">
                Mỗi danh mục là một nhóm chủ đề trong catalog Listening. Học viên
                chỉ thấy nội dung khi <strong>cả danh mục và nội dung</strong> đều
                đã xuất bản.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/admin/listening"
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Nội dung Listening
              </Link>
              <button
                onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Plus size={16} />
                Thêm danh mục
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
              <AlertTriangle size={16} className="shrink-0 mt-px" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
            {isLoading ? (
              <div className="p-10 text-center text-sm font-semibold text-slate-400">
                Đang tải danh mục...
              </div>
            ) : categories.length === 0 ? (
              <div className="p-10 text-center">
                <Headphones size={32} className="mx-auto text-slate-300" />
                <p className="text-sm font-semibold text-slate-500 mt-3">
                  Chưa có danh mục nào.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Tạo danh mục đầu tiên để bắt đầu thêm nội dung Listening.
                </p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-5 py-3">Danh mục</th>
                    <th className="px-5 py-3">Nội dung</th>
                    <th className="px-5 py-3">Trạng thái</th>
                    <th className="px-5 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {categories.map((category) => (
                    <tr key={category.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-4">
                        <p className="text-sm font-bold text-slate-800">
                          {category.name}
                        </p>
                        <p className="text-xs text-slate-500">{category.nameVi}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                          <Layers size={13} />
                          {category.contentCount}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {category.isPublished ? (
                          <span className="px-2.5 py-1 text-[10px] font-bold uppercase bg-emerald-50 text-emerald-600 rounded-md">
                            Đã xuất bản
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-[10px] font-bold uppercase bg-slate-100 text-slate-500 rounded-md">
                            Nháp
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => togglePublish(category)}
                            disabled={pendingActionId === category.id}
                            title={
                              category.isPublished
                                ? 'Gỡ xuất bản — ẩn toàn bộ nội dung bên trong khỏi học viên'
                                : 'Xuất bản danh mục'
                            }
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-40"
                          >
                            {category.isPublished ? (
                              <EyeOff size={16} />
                            ) : (
                              <Eye size={16} />
                            )}
                          </button>
                          <button
                            onClick={() => openEdit(category)}
                            title="Sửa"
                            className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => remove(category)}
                            disabled={pendingActionId === category.id}
                            title={
                              category.contentCount > 0
                                ? 'Không thể xóa khi còn nội dung bên trong'
                                : 'Xóa danh mục'
                            }
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-40"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>

      {isCreateOpen && (
        <Modal onClose={closeModals} title="Thêm danh mục Listening">
          <form onSubmit={submitCreate} className="space-y-4">
            {formFields}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeModals}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Đang lưu...' : 'Tạo danh mục'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal onClose={closeModals} title="Sửa danh mục Listening">
          <form onSubmit={submitEdit} className="space-y-4">
            {formFields}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeModals}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default AdminListeningCategories;
