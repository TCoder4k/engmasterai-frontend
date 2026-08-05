import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import Modal from '../shared/Modal';
import { handleAuthError } from '../../services/apiError';
import { CefrLevel } from '../../types';
import {
  ListeningMediaProvider,
  ListeningMediaType,
  ListeningMode,
  ManagedListeningCategory,
  ManagedListeningContentSummary,
  createListeningContent,
  deleteListeningContent,
  getListeningCategories,
  getListeningContents,
} from '../../services/listeningAdminService';
import {
  Plus,
  Trash2,
  Headphones,
  AlertTriangle,
  ListOrdered,
  Pencil,
  Youtube,
  FileAudio,
} from 'lucide-react';

// Sprint 11 — /admin/listening.
//
// The list is deliberately a LIST, not an editor: creating a recording asks
// only for what a recording cannot exist without, and everything else
// (segments, timings, attribution, modes) is edited on its own page. A single
// mega-form would make adding a title feel as heavy as transcribing nine
// minutes of audio.

const LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

interface ContentFormState {
  categoryId: string;
  title: string;
  level: CefrLevel;
  mediaType: ListeningMediaType;
  mediaProvider: ListeningMediaProvider;
  mediaUrl: string;
}

const emptyForm: ContentFormState = {
  categoryId: '',
  title: '',
  level: 'B1',
  mediaType: 'VIDEO',
  mediaProvider: 'YOUTUBE',
  mediaUrl: '',
};

const MODE_LABEL: Record<ListeningMode, string> = {
  DICTATION: 'Dictation',
  SHADOWING: 'Shadowing',
};

const AdminListeningContents: React.FC = () => {
  const navigate = useNavigate();

  const [contents, setContents] = useState<ManagedListeningContentSummary[]>([]);
  const [categories, setCategories] = useState<ManagedListeningCategory[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState<ContentFormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const load = (categoryId: string) => {
    setIsLoading(true);
    setError(null);
    Promise.all([
      getListeningContents(1, 100, categoryId || undefined),
      getListeningCategories(),
    ])
      .then(([contentRes, categoryRes]) => {
        setContents(contentRes.data);
        setCategories(categoryRes);
      })
      .catch((err) => setError(handleAuthError(err, navigate)))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load(categoryFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter]);

  const openCreate = () => {
    setForm({ ...emptyForm, categoryId: categories[0]?.id ?? '' });
    setFormError(null);
    setIsCreateOpen(true);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError(null);
    try {
      const created = await createListeningContent({
        categoryId: form.categoryId,
        title: form.title,
        level: form.level,
        mediaType: form.mediaType,
        mediaProvider: form.mediaProvider,
        mediaUrl: form.mediaUrl,
        // A new recording enables nothing. The author picks modes on the
        // editor once the sentence lengths are known — shadowing has a 30s
        // per-sentence limit that cannot be judged before transcribing.
        supportedModes: [],
      });
      setIsCreateOpen(false);
      // Straight into the editor: a recording with no segments is not usable
      // yet, so landing back on the list would just mean one more click.
      navigate(`/admin/listening/${created.id}`);
    } catch (err) {
      setFormError(handleAuthError(err, navigate));
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (content: ManagedListeningContentSummary) => {
    if (
      !window.confirm(
        `Xóa "${content.title}" cùng ${content.segmentCount} câu bên trong? Hành động này không thể hoàn tác.`,
      )
    ) {
      return;
    }

    setPendingActionId(content.id);
    setError(null);
    try {
      await deleteListeningContent(content.id);
      load(categoryFilter);
    } catch (err) {
      setError(handleAuthError(err, navigate));
    } finally {
      setPendingActionId(null);
    }
  };

  const chipClass = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
      active
        ? 'bg-blue-600 text-white shadow-sm'
        : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-800'
    }`;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar />
      <div className="flex-1 min-w-0">
        <AdminHeader />
        <main className="p-8 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-black text-slate-900">
                Nội dung Listening
              </h1>
              <p className="text-xs font-medium text-slate-500 mt-1">
                Mỗi bản ghi được tạo <strong>một lần</strong> và có thể bật nhiều
                chế độ luyện tập. Dictation và Shadowing dùng chung media,
                transcript và timestamp.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/admin/listening/categories"
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Danh mục
              </Link>
              <button
                onClick={openCreate}
                disabled={categories.length === 0}
                title={
                  categories.length === 0
                    ? 'Cần tạo ít nhất một danh mục trước'
                    : undefined
                }
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-40"
              >
                <Plus size={16} />
                Thêm nội dung
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
              <AlertTriangle size={16} className="shrink-0 mt-px" />
              <span>{error}</span>
            </div>
          )}

          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCategoryFilter('')}
                className={chipClass(categoryFilter === '')}
              >
                Tất cả
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setCategoryFilter(category.id)}
                  className={chipClass(categoryFilter === category.id)}
                >
                  {category.name} ({category.contentCount})
                </button>
              ))}
            </div>
          )}

          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
            {isLoading ? (
              <div className="p-10 text-center text-sm font-semibold text-slate-400">
                Đang tải nội dung...
              </div>
            ) : contents.length === 0 ? (
              <div className="p-10 text-center">
                <Headphones size={32} className="mx-auto text-slate-300" />
                <p className="text-sm font-semibold text-slate-500 mt-3">
                  {categoryFilter
                    ? 'Danh mục này chưa có nội dung nào.'
                    : 'Chưa có nội dung Listening nào.'}
                </p>
                {categories.length === 0 && (
                  <p className="text-xs text-slate-400 mt-1">
                    Tạo danh mục trước, rồi thêm nội dung vào đó.
                  </p>
                )}
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-5 py-3">Nội dung</th>
                    <th className="px-5 py-3">Media</th>
                    <th className="px-5 py-3">Câu</th>
                    <th className="px-5 py-3">Chế độ</th>
                    <th className="px-5 py-3">Trạng thái</th>
                    <th className="px-5 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {contents.map((content) => (
                    <tr key={content.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-4">
                        <Link
                          to={`/admin/listening/${content.id}`}
                          className="text-sm font-bold text-slate-800 hover:text-blue-600 transition-colors"
                        >
                          {content.title}
                        </Link>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {content.category.name}
                          <span className="mx-1.5 text-slate-300">·</span>
                          {content.level}
                          {!content.category.isPublished && (
                            <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold uppercase bg-amber-50 text-amber-600 rounded">
                              Danh mục nháp
                            </span>
                          )}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                          {content.mediaProvider === 'YOUTUBE' ? (
                            <Youtube size={14} />
                          ) : (
                            <FileAudio size={14} />
                          )}
                          {content.mediaProvider === 'YOUTUBE'
                            ? 'YouTube'
                            : content.mediaType === 'AUDIO'
                              ? 'Audio'
                              : 'Video'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                          <ListOrdered size={13} />
                          {content.segmentCount}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {content.supportedModes.length === 0 ? (
                          <span className="text-xs font-semibold text-slate-300">
                            —
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {content.supportedModes.map((mode) => (
                              <span
                                key={mode}
                                className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-600 rounded"
                              >
                                {MODE_LABEL[mode]}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {content.isPublished ? (
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
                          <Link
                            to={`/admin/listening/${content.id}`}
                            title="Mở trình soạn thảo"
                            className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors inline-flex"
                          >
                            <Pencil size={16} />
                          </Link>
                          <button
                            onClick={() => remove(content)}
                            disabled={pendingActionId === content.id}
                            title="Xóa nội dung"
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
        <Modal onClose={() => setIsCreateOpen(false)} title="Thêm nội dung Listening">
          <form onSubmit={submitCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                Danh mục
              </label>
              <select
                required
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                    {category.isPublished ? '' : ' (nháp)'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                Tiêu đề
              </label>
              <input
                type="text"
                required
                maxLength={200}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ví dụ: First treasure recovered from sunken ship"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Nhập tiêu đề sạch, không copy nguyên tiêu đề YouTube kèm emoji.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  Trình độ (CEFR)
                </label>
                <select
                  value={form.level}
                  onChange={(e) =>
                    setForm({ ...form, level: e.target.value as CefrLevel })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                >
                  {LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  Nguồn media
                </label>
                <select
                  value={form.mediaProvider}
                  onChange={(e) => {
                    const provider = e.target.value as ListeningMediaProvider;
                    setForm({
                      ...form,
                      mediaProvider: provider,
                      // YouTube is always VIDEO — publish validation refuses
                      // any other combination, so the form should not offer it.
                      mediaType: provider === 'YOUTUBE' ? 'VIDEO' : form.mediaType,
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                >
                  <option value="YOUTUBE">YouTube</option>
                  <option value="EXTERNAL_URL">Audio/Video URL</option>
                  <option value="CLOUDINARY">Cloudinary</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                URL media
              </label>
              <input
                type="text"
                maxLength={500}
                value={form.mediaUrl}
                onChange={(e) => setForm({ ...form, mediaUrl: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Có thể để trống ở bản nháp và điền sau. Chỉ nhúng — hệ thống không
                tải xuống hay lưu lại video của bên thứ ba.
              </p>
            </div>

            {formError && (
              <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                {formError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Đang tạo...' : 'Tạo và soạn nội dung'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default AdminListeningContents;
