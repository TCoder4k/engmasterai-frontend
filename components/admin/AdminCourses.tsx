import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import Modal from '../shared/Modal';
import { handleAuthError } from '../../services/apiError';
import {
  getManagedCourses,
  createCourse,
  updateCourse,
  publishCourse,
  unpublishCourse,
  deleteCourse,
} from '../../services/courseService';
import { ManagedCourse, CourseType } from '../../types';
import { Plus, Pencil, Trash2, Eye, EyeOff, BookText, Layers } from 'lucide-react';

const COURSE_TYPES: CourseType[] = ['GRAMMAR', 'VOCABULARY', 'LISTENING'];

interface CourseFormState {
  title: string;
  type: CourseType;
  description: string;
  thumbnail: string;
}

const emptyForm: CourseFormState = { title: '', type: 'GRAMMAR', description: '', thumbnail: '' };

const AdminCourses: React.FC = () => {
  const navigate = useNavigate();

  const [courses, setCourses] = useState<ManagedCourse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<ManagedCourse | null>(null);
  const [form, setForm] = useState<CourseFormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const loadCourses = () => {
    setIsLoading(true);
    setError(null);
    getManagedCourses(1, 100)
      .then((res) => setCourses(res.data))
      .catch((err) => setError(handleAuthError(err, navigate)))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setFormError(null);
    setIsCreateOpen(true);
  };

  const openEdit = (course: ManagedCourse) => {
    setEditingCourse(course);
    setForm({
      title: course.title,
      type: course.type,
      description: course.description,
      thumbnail: course.thumbnail || '',
    });
    setFormError(null);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError(null);
    try {
      await createCourse({
        title: form.title,
        type: form.type,
        description: form.description,
        thumbnail: form.thumbnail || undefined,
      });
      setIsCreateOpen(false);
      loadCourses();
    } catch (err) {
      setFormError(handleAuthError(err, navigate));
    } finally {
      setIsSaving(false);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;
    setIsSaving(true);
    setFormError(null);
    try {
      await updateCourse(editingCourse.id, {
        title: form.title,
        type: form.type,
        description: form.description,
        thumbnail: form.thumbnail || undefined,
      });
      setEditingCourse(null);
      loadCourses();
    } catch (err) {
      setFormError(handleAuthError(err, navigate));
    } finally {
      setIsSaving(false);
    }
  };

  const togglePublish = async (course: ManagedCourse) => {
    setPendingActionId(course.id);
    setError(null);
    try {
      if (course.isPublished) {
        await unpublishCourse(course.id);
      } else {
        await publishCourse(course.id);
      }
      loadCourses();
    } catch (err) {
      setError(handleAuthError(err, navigate));
    } finally {
      setPendingActionId(null);
    }
  };

  const handleDelete = async (course: ManagedCourse) => {
    if (!window.confirm(`Xóa khóa học "${course.title}"?`)) return;
    setPendingActionId(course.id);
    setError(null);
    try {
      await deleteCourse(course.id);
      loadCourses();
    } catch (err) {
      // Includes the backend's 400 "remove lessons first" message when the
      // course still has lessons — surfaced as-is, not swallowed.
      setError(handleAuthError(err, navigate));
    } finally {
      setPendingActionId(null);
    }
  };

  const goToLessons = (course: ManagedCourse) => {
    navigate(`/admin/courses/${course.id}/lessons`, { state: { courseTitle: course.title } });
  };

  return (
    <div className="min-h-screen flex bg-[#fbfcfd]">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AdminHeader />

        <main className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Khóa học (Courses)</h1>
              <p className="text-sm text-slate-500 font-medium">Quản lý khóa học Grammar / Vocabulary / Listening.</p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all"
            >
              <Plus size={16} />
              <span>Tạo khóa học</span>
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
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Khóa học</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loại</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Bài học</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trạng thái</th>
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

                  {!isLoading && courses.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400 font-medium">
                        Chưa có khóa học nào. Bấm "Tạo khóa học" để bắt đầu.
                      </td>
                    </tr>
                  )}

                  {!isLoading && courses.map((course) => (
                    <tr key={course.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 overflow-hidden">
                            {course.thumbnail ? (
                              <img src={course.thumbnail} className="w-full h-full object-cover" alt="" />
                            ) : (
                              <BookText size={20} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate max-w-xs">{course.title}</p>
                            <p className="text-[11px] text-slate-400 truncate max-w-xs">{course.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-slate-600 uppercase">{course.type}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => goToLessons(course)}
                          title="Quản lý bài học"
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          {course._count.lessons} bài học
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => togglePublish(course)}
                          disabled={pendingActionId === course.id}
                          className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                            course.isPublished ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                          } hover:opacity-70`}
                        >
                          {course.isPublished ? <Eye size={12} /> : <EyeOff size={12} />}
                          <span>
                            {pendingActionId === course.id ? '...' : course.isPublished ? 'Công khai' : 'Bản nháp'}
                          </span>
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => goToLessons(course)}
                            className="inline-flex items-center space-x-1.5 px-3 py-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all text-xs font-bold"
                            title="Quản lý bài học"
                          >
                            <Layers size={16} />
                            <span className="hidden sm:inline">Quản lý bài học</span>
                          </button>
                          <button
                            onClick={() => openEdit(course)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Chỉnh sửa"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(course)}
                            disabled={pendingActionId === course.id}
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

      {(isCreateOpen || editingCourse) && (
        <Modal
          title={editingCourse ? `Chỉnh sửa: ${editingCourse.title}` : 'Tạo khóa học mới'}
          onClose={() => {
            setIsCreateOpen(false);
            setEditingCourse(null);
          }}
        >
          <form onSubmit={editingCourse ? submitEdit : submitCreate} className="space-y-4">
            {formError && (
              <div className="bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium px-4 py-3 rounded-xl">
                {formError}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Tiêu đề</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Loại khóa học</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as CourseType }))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
              >
                {COURSE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
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
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingCourse(null);
                }}
                className="px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all disabled:opacity-60"
              >
                {isSaving ? 'Đang lưu...' : editingCourse ? 'Lưu thay đổi' : 'Tạo khóa học'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default AdminCourses;
