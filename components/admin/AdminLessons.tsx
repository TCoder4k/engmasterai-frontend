import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import Modal from '../shared/Modal';
import { handleAuthError } from '../../services/apiError';
import {
  getManagedLessons,
  createLesson,
  updateLesson,
  publishLesson,
  unpublishLesson,
  deleteLesson,
} from '../../services/lessonService';
import { ManagedLesson } from '../../types';
import { Plus, Pencil, Trash2, Eye, EyeOff, ArrowLeft, PlayCircle, Headphones } from 'lucide-react';

interface LessonFormState {
  title: string;
  description: string;
  notes: string;
  videoUrl: string;
  pdfUrl: string;
  audioUrl: string;
  videoDurationMinutes: string;
  estimatedStudyMinutes: string;
  learningObjectives: string; // newline-separated in the form, max 10 lines
}

const emptyForm: LessonFormState = {
  title: '',
  description: '',
  notes: '',
  videoUrl: '',
  pdfUrl: '',
  audioUrl: '',
  videoDurationMinutes: '',
  estimatedStudyMinutes: '',
  learningObjectives: '',
};

const toDto = (form: LessonFormState) => {
  const objectives = form.learningObjectives
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10); // backend caps at 10; trim client-side so the request doesn't 400 on this alone

  return {
    title: form.title,
    description: form.description || undefined,
    notes: form.notes || undefined,
    videoUrl: form.videoUrl || undefined,
    pdfUrl: form.pdfUrl || undefined,
    audioUrl: form.audioUrl || undefined,
    videoDurationMinutes: form.videoDurationMinutes ? Number(form.videoDurationMinutes) : undefined,
    estimatedStudyMinutes: form.estimatedStudyMinutes ? Number(form.estimatedStudyMinutes) : undefined,
    learningObjectives: objectives.length > 0 ? objectives : undefined,
  };
};

const AdminLessons: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { courseId } = useParams<{ courseId: string }>();
  // Best-effort title from the course row's navigate state — there is no
  // admin single-course GET and GET /courses/:id 404s drafts, so on a hard
  // refresh (state lost) we fall back to a generic heading rather than
  // scanning the paginated manage-courses list (which could silently miss
  // courses past page 1).
  const courseTitle = (location.state as { courseTitle?: string } | null)?.courseTitle;

  const [lessons, setLessons] = useState<ManagedLesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<ManagedLesson | null>(null);
  const [form, setForm] = useState<LessonFormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const loadLessons = () => {
    if (!courseId) return;
    setIsLoading(true);
    setError(null);
    getManagedLessons(courseId)
      .then((res) => setLessons(res.data))
      .catch((err) => setError(handleAuthError(err, navigate)))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadLessons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const openCreate = () => {
    setForm(emptyForm);
    setFormError(null);
    setIsCreateOpen(true);
  };

  const openEdit = (lesson: ManagedLesson) => {
    setEditingLesson(lesson);
    setForm({
      title: lesson.title,
      description: lesson.description || '',
      notes: lesson.notes || '',
      videoUrl: lesson.videoUrl || '',
      pdfUrl: lesson.pdfUrl || '',
      audioUrl: lesson.audioUrl || '',
      videoDurationMinutes: lesson.videoDurationMinutes?.toString() || '',
      estimatedStudyMinutes: lesson.estimatedStudyMinutes?.toString() || '',
      learningObjectives: lesson.learningObjectives.join('\n'),
    });
    setFormError(null);
  };

  const closeModals = () => {
    setIsCreateOpen(false);
    setEditingLesson(null);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    setIsSaving(true);
    setFormError(null);
    try {
      await createLesson(courseId, toDto(form));
      closeModals();
      loadLessons();
    } catch (err) {
      setFormError(handleAuthError(err, navigate));
    } finally {
      setIsSaving(false);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLesson) return;
    setIsSaving(true);
    setFormError(null);
    try {
      await updateLesson(editingLesson.id, toDto(form));
      closeModals();
      loadLessons();
    } catch (err) {
      setFormError(handleAuthError(err, navigate));
    } finally {
      setIsSaving(false);
    }
  };

  const togglePublish = async (lesson: ManagedLesson) => {
    setPendingActionId(lesson.id);
    setError(null);
    try {
      if (lesson.isPublished) {
        await unpublishLesson(lesson.id);
      } else {
        // Backend rejects with 400 if neither videoUrl nor audioUrl is set —
        // surfaced as-is via handleAuthError/error.message below.
        await publishLesson(lesson.id);
      }
      loadLessons();
    } catch (err) {
      setError(handleAuthError(err, navigate));
    } finally {
      setPendingActionId(null);
    }
  };

  const handleDelete = async (lesson: ManagedLesson) => {
    if (!window.confirm(`Xóa bài học "${lesson.title}"?`)) return;
    setPendingActionId(lesson.id);
    setError(null);
    try {
      await deleteLesson(lesson.id);
      loadLessons();
    } catch (err) {
      // Includes the backend's 400 "remove tasks first" message when the
      // lesson still has tasks.
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
                to="/admin/courses"
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors mb-2"
              >
                <ArrowLeft size={14} />
                <span>Quay lại Khóa học</span>
              </Link>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                {courseTitle ? `Bài học — ${courseTitle}` : 'Bài học'}
              </h1>
              {/* On a hard refresh the router state (courseTitle) is lost and
                  there's no admin single-course GET to recover it, so fall
                  back to showing the courseId for context instead of a title. */}
              <p className="text-sm text-slate-500 font-medium">
                {courseTitle
                  ? 'Sắp xếp theo thứ tự hiển thị (orderIndex).'
                  : `Khóa học ID: ${courseId} · sắp xếp theo orderIndex.`}
              </p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all"
            >
              <Plus size={16} />
              <span>Thêm bài học</span>
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
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">#</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bài học</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Media</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Tasks</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trạng thái</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoading && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400 font-medium">
                        Đang tải...
                      </td>
                    </tr>
                  )}

                  {!isLoading && lessons.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400 font-medium">
                        Chưa có bài học nào. Bấm "Thêm bài học" để bắt đầu.
                      </td>
                    </tr>
                  )}

                  {!isLoading && lessons.map((lesson) => (
                    <tr key={lesson.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4 text-center">
                        <span className="text-xs font-bold text-slate-400">{lesson.orderIndex}</span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-900 truncate max-w-xs">{lesson.title}</p>
                        {lesson.description && (
                          <p className="text-[11px] text-slate-400 truncate max-w-xs">{lesson.description}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center space-x-2 text-slate-300">
                          {lesson.videoUrl && <PlayCircle size={16} className="text-indigo-500" />}
                          {lesson.audioUrl && <Headphones size={16} className="text-indigo-500" />}
                          {!lesson.videoUrl && !lesson.audioUrl && <span className="text-[10px] font-bold">—</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-xs font-bold text-slate-500">{lesson._count.tasks}</span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => togglePublish(lesson)}
                          disabled={pendingActionId === lesson.id}
                          className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                            lesson.isPublished ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                          } hover:opacity-70`}
                        >
                          {lesson.isPublished ? <Eye size={12} /> : <EyeOff size={12} />}
                          <span>
                            {pendingActionId === lesson.id ? '...' : lesson.isPublished ? 'Công khai' : 'Bản nháp'}
                          </span>
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => openEdit(lesson)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Chỉnh sửa"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(lesson)}
                            disabled={pendingActionId === lesson.id}
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

      {(isCreateOpen || editingLesson) && (
        <Modal
          title={editingLesson ? `Chỉnh sửa: ${editingLesson.title}` : 'Thêm bài học mới'}
          onClose={closeModals}
        >
          <form onSubmit={editingLesson ? submitEdit : submitCreate} className="space-y-4">
            {formError && (
              <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm font-medium px-4 py-3 rounded-xl">
                {formError}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Tiêu đề</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/30 focus:border-indigo-300 dark:focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Mô tả (tùy chọn)</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/30 focus:border-indigo-300 dark:focus:border-indigo-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Video URL (https)</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={form.videoUrl}
                  onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/30 focus:border-indigo-300 dark:focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Audio URL (https)</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={form.audioUrl}
                  onChange={(e) => setForm((f) => ({ ...f, audioUrl: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/30 focus:border-indigo-300 dark:focus:border-indigo-500"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 -mt-2">
              Cần ít nhất video hoặc audio để xuất bản (publish).
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">PDF URL (tùy chọn, https)</label>
              <input
                type="text"
                placeholder="https://..."
                value={form.pdfUrl}
                onChange={(e) => setForm((f) => ({ ...f, pdfUrl: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/30 focus:border-indigo-300 dark:focus:border-indigo-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Thời lượng video (phút)</label>
                <input
                  type="number"
                  min={0}
                  value={form.videoDurationMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, videoDurationMinutes: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/30 focus:border-indigo-300 dark:focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Thời gian học dự kiến (phút)</label>
                <input
                  type="number"
                  min={0}
                  value={form.estimatedStudyMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, estimatedStudyMinutes: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/30 focus:border-indigo-300 dark:focus:border-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                Mục tiêu học tập (mỗi dòng 1 mục, tối đa 10)
              </label>
              <textarea
                rows={4}
                value={form.learningObjectives}
                onChange={(e) => setForm((f) => ({ ...f, learningObjectives: e.target.value }))}
                placeholder={'Ví dụ:\nHiểu cấu trúc thì hiện tại đơn\nPhân biệt hiện tại đơn và hiện tại tiếp diễn'}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/30 focus:border-indigo-300 dark:focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                Ghi chú giáo viên / transcript (tùy chọn, chưa hiển thị cho học viên)
              </label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/30 focus:border-indigo-300 dark:focus:border-indigo-500"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={closeModals}
                className="px-4 py-2.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all disabled:opacity-60"
              >
                {isSaving ? 'Đang lưu...' : editingLesson ? 'Lưu thay đổi' : 'Thêm bài học'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default AdminLessons;
