import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import Modal from '../shared/Modal';
import { authService } from '../../services/authService';
import { handleAuthError } from '../../services/apiError';
import { getUsers, updateUserAsAdmin, deleteUser, User } from '../../services/userService';
import { ChevronLeft, ChevronRight, Pencil, Trash2, ShieldCheck, User as UserIcon } from 'lucide-react';

const PAGE_SIZE = 10;

const AdminUsers: React.FC = () => {
  const navigate = useNavigate();
  const currentUserId = authService.getUser()?.id;

  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingRoleChangeId, setPendingRoleChangeId] = useState<string | null>(null);

  const loadUsers = (targetPage: number) => {
    setIsLoading(true);
    setError(null);
    getUsers(targetPage, PAGE_SIZE)
      .then((res) => {
        setUsers(res.data);
        setTotalPages(res.meta.totalPages || 1);
        setTotal(res.meta.total);
        setPage(res.meta.page);
      })
      .catch((err) => setError(handleAuthError(err, navigate)))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadUsers(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEdit = (user: User) => {
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
      loadUsers(page);
    } catch (err) {
      setFormError(handleAuthError(err, navigate));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleRole = async (user: User) => {
    setPendingRoleChangeId(user.id);
    setError(null);
    const nextRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN';
    try {
      await updateUserAsAdmin(user.id, { role: nextRole });
      loadUsers(page);
    } catch (err) {
      setError(handleAuthError(err, navigate));
    } finally {
      setPendingRoleChangeId(null);
    }
  };

  const confirmDelete = async (id: string, name: string) => {
    if (!window.confirm(`Xóa tài khoản "${name}"? Hành động này không thể hoàn tác.`)) return;
    setPendingDeleteId(id);
    setError(null);
    try {
      await deleteUser(id);
      // If we just deleted the last row on a page beyond 1, step back a page.
      const nextPage = users.length === 1 && page > 1 ? page - 1 : page;
      loadUsers(nextPage);
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
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Người dùng</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vai trò</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Level</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tham gia</th>
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

                  {!isLoading && users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400 font-medium">
                        Chưa có người dùng nào.
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
                              <p className="text-sm font-bold text-slate-900">
                                {user.name} {isSelf && <span className="text-indigo-500 font-bold text-[10px]">(Bạn)</span>}
                              </p>
                              <p className="text-[11px] text-slate-400">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => toggleRole(user)}
                            disabled={isSelf || pendingRoleChangeId === user.id}
                            title={isSelf ? 'Không thể tự đổi vai trò của chính mình' : 'Đổi vai trò'}
                            className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                              user.role === 'ADMIN' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
                            } ${isSelf ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-70 cursor-pointer'}`}
                          >
                            {user.role === 'ADMIN' ? <ShieldCheck size={12} /> : <UserIcon size={12} />}
                            <span>{pendingRoleChangeId === user.id ? '...' : user.role}</span>
                          </button>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm font-bold text-slate-700">{user.level}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-slate-500 font-medium">
                            {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => openEdit(user)}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              title="Chỉnh sửa"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => confirmDelete(user.id, user.name)}
                              disabled={isSelf || pendingDeleteId === user.id}
                              title={isSelf ? 'Không thể tự xóa tài khoản của chính mình' : 'Xóa'}
                              className={`p-2 rounded-lg transition-all ${
                                isSelf
                                  ? 'text-slate-200 cursor-not-allowed'
                                  : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              }`}
                            >
                              <Trash2 size={16} />
                            </button>
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
                    onClick={() => loadUsers(page - 1)}
                    disabled={page <= 1}
                    className="p-2 rounded-lg border border-slate-100 text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => loadUsers(page + 1)}
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
              <div className="bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium px-4 py-3 rounded-xl">
                {formError}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Tên</label>
              <input
                type="text"
                required
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Email</label>
              <input
                type="email"
                required
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all disabled:opacity-60"
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
