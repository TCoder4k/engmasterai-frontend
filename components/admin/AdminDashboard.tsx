
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import { handleAuthError } from '../../services/apiError';
import { getUsers, User } from '../../services/userService';
import { getManagedCourses } from '../../services/courseService';
import { ManagedCourse } from '../../types';
import {
  Users,
  BookOpen,
  Gamepad2,
  Clock,
  Download,
  Calendar,
  ChevronRight,
  BrainCircuit
} from 'lucide-react';

// Wraps a widget that has no real backend behind it yet (fake chart, level
// distribution, per-user status/progress, seminar card). Keeps the original
// visual layout in place (per the "keep layout, mark Sắp có" decision) but
// dims it and overlays an honest placeholder instead of showing fabricated
// numbers as if they were real.
const ComingSoon: React.FC<{ children: React.ReactNode; label?: string }> = ({ children, label = 'Sắp có' }) => (
  <div className="relative">
    <div className="pointer-events-none select-none opacity-30 blur-[1px]">{children}</div>
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white px-3 py-1.5 rounded-full shadow-lg">
        {label}
      </span>
    </div>
  </div>
);

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();

  const [learners, setLearners] = useState<User[]>([]);
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [courses, setCourses] = useState<ManagedCourse[]>([]);
  const [totalCourses, setTotalCourses] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getUsers(1, 5)
      .then((res) => {
        setLearners(res.data);
        setTotalUsers(res.meta.total);
      })
      .catch((err) => setError(handleAuthError(err, navigate)));

    getManagedCourses(1, 5)
      .then((res) => {
        setCourses(res.data);
        setTotalCourses(res.meta.total);
      })
      .catch((err) => setError(handleAuthError(err, navigate)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="min-h-screen flex bg-[#fbfcfd]">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AdminHeader />

        <main className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Main Hero Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-indigo-600 font-bold text-xs uppercase tracking-widest">
                <BrainCircuit size={14} />
                <span>Analytics Core</span>
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Thống kê vận hành EngMaster</h1>
              <p className="text-sm text-slate-500 font-medium">Theo dõi dữ liệu học tập, sự tăng trưởng cấp độ và hiệu suất nội dung.</p>
            </div>

            <div className="flex items-center space-x-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
              <div className="px-4 py-2 border-r border-slate-100 flex flex-col items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Hôm nay</span>
                <span className="text-sm font-black text-slate-800">{today}</span>
              </div>
              <button className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all">
                <Download size={16} />
                <span>Báo cáo tuần</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium px-4 py-3 rounded-2xl">
              {error}
            </div>
          )}

          {/* Quick Stats Grid — only real, derivable numbers are shown as real */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Users size={22} />
                </div>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng Học Viên</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{totalUsers ?? '—'}</h3>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <BookOpen size={22} />
                </div>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng Khóa Học</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{totalCourses ?? '—'}</h3>
            </div>

            {/* No level/study-time/completion-rate aggregate exists on the
                backend yet — shown honestly as "Sắp có" rather than a fake number. */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-purple-50 text-purple-600">
                  <Gamepad2 size={22} />
                </div>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cấp độ trung bình</p>
              <h3 className="text-2xl font-black text-slate-300 mt-1">Sắp có</h3>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-orange-50 text-orange-600">
                  <Clock size={22} />
                </div>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Thời gian học/ngày</p>
              <h3 className="text-2xl font-black text-slate-300 mt-1">Sắp có</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Learning Analytics & User List */}
            <div className="xl:col-span-2 space-y-8">

              {/* Analytics chart — no time-series study data exists yet */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Phân tích học tập định kỳ</h3>
                    <p className="text-xs text-slate-400 font-medium">Thời gian học trung bình 7 ngày qua</p>
                  </div>
                </div>

                <ComingSoon>
                  <div className="h-48 w-full flex items-end justify-between space-x-2 px-2">
                    {[45, 60, 30, 80, 55, 90, 75].map((val, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center">
                        <div className="w-full bg-indigo-50 rounded-t-xl" style={{ height: `${val}%` }}></div>
                        <span className="text-[10px] font-bold text-slate-400 mt-3 uppercase">T{i + 2}</span>
                      </div>
                    ))}
                  </div>
                </ComingSoon>
              </div>

              {/* Recent learners — real data from GET /users */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">Học viên gần đây</h3>
                  <button
                    onClick={() => navigate('/admin/users')}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Xem danh sách
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Học viên & Cấp độ</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Tiến độ tuần</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {learners.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-6 py-8 text-center text-sm text-slate-400 font-medium">
                            Chưa có học viên nào.
                          </td>
                        </tr>
                      )}
                      {learners.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-3">
                              <div className="relative">
                                <img
                                  src={user.avatarUrl || `https://picsum.photos/seed/${user.id}/100/100`}
                                  className="w-10 h-10 rounded-2xl object-cover bg-slate-100 border border-slate-100"
                                  alt=""
                                />
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-indigo-600 text-white text-[9px] font-black rounded-lg flex items-center justify-center border-2 border-white shadow-sm">
                                  {user.level}
                                </div>
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-900">{user.name}</p>
                                <p className="text-[11px] text-slate-400">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          {/* No per-user weekly-progress data exists yet */}
                          <td className="px-6 py-4">
                            <ComingSoon>
                              <div className="flex items-center justify-center">
                                <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: '50%' }}></div>
                                </div>
                              </div>
                            </ComingSoon>
                          </td>
                          {/* No active/locked status field exists on User yet */}
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase bg-slate-100 text-slate-400">
                              Sắp có
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Sidebar Tools & Course Performance */}
            <div className="space-y-8">
              {/* Level distribution — no level-tier breakdown exists yet */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                <h3 className="font-bold text-slate-900 mb-6 flex items-center">
                  <Gamepad2 size={18} className="mr-2 text-indigo-600" />
                  Phân bố Cấp độ
                </h3>
                <ComingSoon>
                  <div className="space-y-5">
                    {[
                      { label: 'Sơ cấp (Lv 1-10)', percent: 35, color: 'bg-blue-400' },
                      { label: 'Trung cấp (Lv 11-30)', percent: 48, color: 'bg-indigo-500' },
                      { label: 'Cao cấp (Lv 31+)', percent: 17, color: 'bg-purple-600' }
                    ].map((tier, i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-500">{tier.label}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden">
                          <div className={`h-full ${tier.color} rounded-full`} style={{ width: `${tier.percent}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ComingSoon>
                <button
                  disabled
                  className="w-full mt-8 py-3 bg-slate-100 text-slate-400 rounded-2xl text-xs font-bold cursor-not-allowed flex items-center justify-center"
                >
                  Điều chỉnh Rank & Reward
                  <ChevronRight size={14} className="ml-1" />
                </button>
              </div>

              {/* Course performance — real data from GET /courses/manage */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-slate-900">Khóa học gần đây</h3>
                  <button
                    onClick={() => navigate('/admin/courses')}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase"
                  >
                    Xem tất cả
                  </button>
                </div>
                <div className="space-y-4">
                  {courses.length === 0 && (
                    <p className="text-sm text-slate-400 font-medium">Chưa có khóa học nào.</p>
                  )}
                  {courses.map((course) => (
                    <div
                      key={course.id}
                      onClick={() => navigate('/admin/courses')}
                      className="flex items-center space-x-3 p-3 hover:bg-indigo-50 rounded-2xl transition-all cursor-pointer border border-transparent hover:border-indigo-100"
                    >
                      <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                        <BookOpen size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{course.title}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                          {course._count.lessons} bài học
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-[10px] font-black uppercase ${
                            course.isPublished ? 'text-emerald-600' : 'text-slate-400'
                          }`}
                        >
                          {course.isPublished ? 'Công khai' : 'Bản nháp'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Schedule summary — no seminar/scheduling feature exists yet */}
              <ComingSoon label="Tính năng đang phát triển">
                <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200">
                  <div className="flex items-center justify-between mb-4">
                    <Calendar size={20} />
                    <span className="text-[10px] font-black bg-white/20 px-2 py-1 rounded-lg">UPCOMING</span>
                  </div>
                  <h4 className="font-bold text-sm mb-2">Buổi Seminar Coaching</h4>
                  <p className="text-xs text-indigo-100 mb-6 opacity-80">Ngày mai, 10:00 AM</p>
                </div>
              </ComingSoon>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
