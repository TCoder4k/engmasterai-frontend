import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import Modal from '../shared/Modal';
import { authService } from '../../services/authService';
import { handleAuthError } from '../../services/apiError';
import { updateUserAsAdmin, deleteUser } from '../../services/userService';
import {
  getStudentOverview,
  AdminStudentListRow,
} from '../../services/adminStudentService';
import {
  learningGoalLabel,
  formatDateVi,
  BADGE_BASE,
  positiveNegativeBadgeClass,
  planBadgeClass,
} from './student/adminStudentFormat';
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  ShieldCheck,
  User as UserIcon,
  MoreVertical,
  Crown,
  Eye,
  Download,
} from 'lucide-react';

const PAGE_SIZE = 10;
const EXPORT_PAGE_SIZE = 20;
// Defensive upper bound on the export loop — real admin lists are nowhere
// near this size; it only guards against an unbounded fetch loop.
const EXPORT_MAX_PAGES = 200;
type PlanFilter = 'ALL' | 'FREE' | 'PRO';
type StatusFilter = 'ALL' | 'ACTIVE' | 'BLOCKED';

const csvCell = (value: string | number): string => {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

const buildStudentsCsv = (rows: AdminStudentListRow[]): string => {
  const header = [
    'Tên',
    'Email',
    'Level',
    'Mục tiêu',
    'Tiến độ (%)',
    'Điểm test TB',
    'Gói',
    'Trạng thái',
    'Ngày tham gia',
  ];
  const lines = rows.map((r) =>
    [
      r.name,
      r.email,
      r.level,
      learningGoalLabel(r.learningGoal),
      r.progressPercent ?? '',
      r.averageTestScore ?? '',
      r.isPro ? 'PRO' : 'Free',
      r.isActive ? 'Active' : 'Blocked',
      formatDateVi(r.createdAt),
    ]
      .map(csvCell)
      .join(','),
  );
  // Leading BOM so Excel opens the Vietnamese diacritics as UTF-8 instead of
  // guessing a legacy codepage.
  return ['﻿' + header.join(','), ...lines].join('\n');
};

const AdminUsers: React.FC = () => {
  const navigate = useNavigate();
  const currentUserId = authService.getUser()?.id;

  // `q` in the URL is the only search box for this page — AdminHeader's
  // Topbar search (the single, global one) writes it via navigate; there is
  // deliberately no second search input here (see 2026-09-14 feedback: a
  // local box duplicating the Topbar one just left people unsure which to
  // type in).
  const [searchParams] = useSearchParams();
  const urlSearch = searchParams.get('q') ?? '';

  const [users, setUsers] = useState<AdminStudentListRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingUser, setEditingUser] = useState<AdminStudentListRow | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingRoleChangeId, setPendingRoleChangeId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Toolbar filters (2026-09-15 feedback) — local-only state, deliberately
  // not synced into the URL: AdminHeader's own debounced-search effect
  // rewrites the whole `?q=` query string on every keystroke, and layering a
  // second param writer on top of that would race it.
  const [planFilter, setPlanFilter] = useState<PlanFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [isExporting, setIsExporting] = useState(false);

  const loadUsers = (
    targetPage: number,
    search: string,
    plan: PlanFilter,
    status: StatusFilter,
  ) => {
    setIsLoading(true);
    setError(null);
    getStudentOverview(
      targetPage,
      PAGE_SIZE,
      search || undefined,
      plan === 'ALL' ? undefined : plan,
      status === 'ALL' ? undefined : status,
    )
      .then((res) => {
        setUsers(res.data);
        setTotalPages(res.meta.totalPages || 1);
        setTotal(res.meta.total);
        setPage(res.meta.page);
      })
      .catch((err) => setError(handleAuthError(err, navigate)))
      .finally(() => setIsLoading(false));
  };

  // The URL search term (written by AdminHeader's Topbar search) plus the
  // two local toolbar filters together drive the fetch — always reset to
  // page 1 when any of them changes, since a page 3 of an old query is
  // meaningless for a new one.
  useEffect(() => {
    loadUsers(1, urlSearch, planFilter, statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearch, planFilter, statusFilter]);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const rows: AdminStudentListRow[] = [];
      let fetchedPage = 1;
      let exportTotalPages = 1;
      do {
        const res = await getStudentOverview(
          fetchedPage,
          EXPORT_PAGE_SIZE,
          urlSearch || undefined,
          planFilter === 'ALL' ? undefined : planFilter,
          statusFilter === 'ALL' ? undefined : statusFilter,
        );
        rows.push(...res.data);
        exportTotalPages = res.meta.totalPages || 1;
        fetchedPage++;
      } while (fetchedPage <= exportTotalPages && fetchedPage <= EXPORT_MAX_PAGES);

      const blob = new Blob([buildStudentsCsv(rows)], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `hoc-vien-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(handleAuthError(err, navigate));
    } finally {
      setIsExporting(false);
    }
  };

  const openEdit = (user: AdminStudentListRow) => {
    setOpenMenuId(null);
    setEditingUser(user);
    setEditForm({ name: user.name, email: user.email });
    setFormError(null);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSaving(true);
    setFormError(null);
    try {
      await updateUserAsAdmin(editingUser.id, { name: editForm.name, email: editForm.email });
      setEditingUser(null);
      loadUsers(page, urlSearch, planFilter, statusFilter);
    } catch (err) {
      setFormError(handleAuthError(err, navigate));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleRole = async (user: AdminStudentListRow) => {
    setOpenMenuId(null);
    setPendingRoleChangeId(user.id);
    setError(null);
    const nextRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN';
    try {
      await updateUserAsAdmin(user.id, { role: nextRole });
      loadUsers(page, urlSearch, planFilter, statusFilter);
    } catch (err) {
      setError(handleAuthError(err, navigate));
    } finally {
      setPendingRoleChangeId(null);
    }
  };

  const confirmDelete = async (id: string, name: string) => {
    setOpenMenuId(null);
    if (!window.confirm(`Xóa tài khoản "${name}"? Hành động này không thể hoàn tác.`)) return;
    setPendingDeleteId(id);
    setError(null);
    try {
      await deleteUser(id);
      // If we just deleted the last row on a page beyond 1, step back a page.
      const nextPage = users.length === 1 && page > 1 ? page - 1 : page;
      loadUsers(nextPage, urlSearch, planFilter, statusFilter);
    } catch (err) {
      setError(handleAuthError(err, navigate));
    } finally {
      setPendingDeleteId(null);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#fbfcfd]">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AdminHeader />

        <main className="flex-1 overflow-y-auto p-8 space-y-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Học viên & Users</h1>
            <p className="text-sm text-slate-500 font-medium">
              Quản lý tài khoản người dùng trong hệ thống ({total} tài khoản).
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ACTIVE">Active</option>
                <option value="BLOCKED">Blocked</option>
              </select>
              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value as PlanFilter)}
                className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
              >
                <option value="ALL">Tất cả gói</option>
                <option value="FREE">Free</option>
                <option value="PRO">PRO</option>
              </select>
            </div>
            <button
              onClick={handleExport}
              disabled={isExporting || isLoading || total === 0}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed self-start sm:self-auto"
            >
              <Download size={14} />
              <span>{isExporting ? 'Đang xuất...' : 'Xuất dữ liệu'}</span>
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
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Học viên</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cấp độ &amp; Mục tiêu</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tiến độ học tập</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Điểm test TB</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gói tài khoản</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trạng thái</th>
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

                  {!isLoading && users.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400 font-medium">
                        {urlSearch
                          ? `Không tìm thấy học viên nào khớp với "${urlSearch}".`
                          : planFilter !== 'ALL' || statusFilter !== 'ALL'
                            ? 'Không có học viên nào khớp với bộ lọc đã chọn.'
                            : 'Chưa có người dùng nào.'}
                      </td>
                    </tr>
                  )}

                  {!isLoading && users.map((user) => {
                    const isSelf = user.id === currentUserId;
                    return (
                      <tr key={user.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <img
                              src={user.avatarUrl || `https://picsum.photos/seed/${user.id}/100/100`}
                              className="w-10 h-10 rounded-2xl object-cover bg-slate-100 border border-slate-100"
                              alt=""
                            />
                            <div>
                              <button
                                onClick={() => navigate(`/admin/users/${user.id}`)}
                                className="text-sm font-bold text-slate-900 hover:text-blue-600 hover:underline text-left transition-colors"
                              >
                                {user.name} {isSelf && <span className="text-blue-500 font-bold text-[10px]">(Bạn)</span>}
                              </button>
                              <p className="text-[11px] text-slate-400">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-slate-700">Level {user.level}</p>
                          <p className="text-[11px] text-slate-400">{learningGoalLabel(user.learningGoal)}</p>
                        </td>
                        <td className="px-6 py-4">
                          {user.progressPercent === null ? (
                            <span className="text-xs text-slate-400 font-medium">Chưa có lộ trình</span>
                          ) : (
                            <div className="w-32">
                              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
                                <span>{user.progressPercent}%</span>
                                <span className="text-slate-400 font-medium">
                                  {user.completedLessons}/{user.totalLessons}
                                </span>
                              </div>
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 rounded-full"
                                  style={{ width: `${Math.min(100, user.progressPercent)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm font-bold text-slate-700">
                            {user.averageTestScore === null ? '—' : `${user.averageTestScore}%`}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {user.isPro ? (
                            <div>
                              <span className={`${BADGE_BASE} ${planBadgeClass(true)}`}>
                                <Crown size={12} />
                                <span>PRO</span>
                              </span>
                              {user.proExpiresAt && (
                                <p className="text-[10px] text-slate-400 mt-1">
                                  Đến {formatDateVi(user.proExpiresAt)}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className={`${BADGE_BASE} ${planBadgeClass(false)}`}>Free</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`${BADGE_BASE} ${positiveNegativeBadgeClass(user.isActive)}`}>
                            {user.isActive ? 'Active' : 'Blocked'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end">
                            <div className="relative">
                              <button
                                onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}
                                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
                                aria-label="Thêm thao tác"
                              >
                                <MoreVertical size={16} />
                              </button>
                              {openMenuId === user.id && (
                                <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-100 rounded-xl shadow-lg z-10 py-1">
                                  <button
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      navigate(`/admin/users/${user.id}`);
                                    }}
                                    className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                  >
                                    <Eye size={14} />
                                    <span>Xem hồ sơ</span>
                                  </button>
                                  <button
                                    onClick={() => openEdit(user)}
                                    className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                  >
                                    <Pencil size={14} />
                                    <span>Chỉnh sửa</span>
                                  </button>
                                  <button
                                    onClick={() => toggleRole(user)}
                                    disabled={isSelf || pendingRoleChangeId === user.id}
                                    className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    {user.role === 'ADMIN' ? <UserIcon size={14} /> : <ShieldCheck size={14} />}
                                    <span>
                                      {pendingRoleChangeId === user.id
                                        ? 'Đang cập nhật...'
                                        : user.role === 'ADMIN'
                                          ? 'Gỡ quyền Admin'
                                          : 'Cấp quyền Admin'}
                                    </span>
                                  </button>
                                  <button
                                    onClick={() => confirmDelete(user.id, user.name)}
                                    disabled={isSelf || pendingDeleteId === user.id}
                                    className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    <Trash2 size={14} />
                                    <span>Xóa tài khoản</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!isLoading && totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-50">
                <span className="text-xs text-slate-400 font-medium">
                  Trang {page} / {totalPages}
                </span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => loadUsers(page - 1, urlSearch, planFilter, statusFilter)}
                    disabled={page <= 1}
                    className="p-2 rounded-lg border border-slate-100 text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => loadUsers(page + 1, urlSearch, planFilter, statusFilter)}
                    disabled={page >= totalPages}
                    className="p-2 rounded-lg border border-slate-100 text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {editingUser && (
        <Modal title={`Chỉnh sửa: ${editingUser.name}`} onClose={() => setEditingUser(null)}>
          <form onSubmit={submitEdit} className="space-y-4">
            {formError && (
              <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm font-medium px-4 py-3 rounded-xl">
                {formError}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Tên</label>
              <input
                type="text"
                required
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/30 focus:border-blue-300 dark:focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Email</label>
              <input
                type="email"
                required
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/30 focus:border-blue-300 dark:focus:border-blue-500"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 py-2.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-60"
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

export default AdminUsers;
