
import React, { useEffect, useState } from 'react';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import EngagementAnalyticsChart from './analytics/EngagementAnalyticsChart';
import UserGrowthChart from './analytics/UserGrowthChart';
import TopStudentsTable from './analytics/TopStudentsTable';
import SkillBreakdownChart from './analytics/SkillBreakdownChart';
import Skeleton from '../shared/Skeleton';
import { handleAuthError } from '../../services/apiError';
import { getAdminDashboardAnalytics, AdminDashboardAnalytics } from '../../services/adminAnalyticsService';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  BookOpen,
  Download,
  BrainCircuit,
} from 'lucide-react';

// 2026-08-21 redesign — the dashboard became a real analytics overview
// (GET /analytics/admin-dashboard), replacing the previous mix of 2 real
// numbers plus several ComingSoon-blurred fake charts/lists. The "Học viên
// gần đây"/"Khóa học gần đây" quick-preview lists this page used to show are
// gone — /admin/users and /admin/courses already own that job, and this page
// now focuses on trends/aggregates instead of duplicating list views.
const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();

  const [data, setData] = useState<AdminDashboardAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    getAdminDashboardAnalytics()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(handleAuthError(err, navigate));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken]);

  const today = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="min-h-screen flex bg-[#fbfcfd]">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AdminHeader />

        <main className="flex-1 overflow-y-auto p-8 space-y-6">
          {/* Main Hero Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-blue-600 font-bold text-xs uppercase tracking-widest">
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
              <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all">
                <Download size={16} />
                <span>Báo cáo tuần</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium px-4 py-3 rounded-2xl flex items-center justify-between gap-4">
              <span>{error}</span>
              <button
                onClick={() => setReloadToken((n) => n + 1)}
                className="shrink-0 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                Thử lại
              </button>
            </div>
          )}

          {/* Quick Stats Grid — only real, derivable numbers are shown as
              real. No study-time aggregate exists on the backend yet; rather
              than a "Sắp có" placeholder card (looks unfinished in a demo),
              that stat is simply not shown until it's real. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Users size={22} />
                </div>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng Học Viên</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{data ? data.summary.totalStudents : '—'}</h3>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <BookOpen size={22} />
                </div>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng Khóa Học</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{data ? data.summary.totalCourses : '—'}</h3>
            </div>
          </div>

          {!error && !data && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)] gap-4">
                <Skeleton className="h-[420px]" />
                <Skeleton className="h-[420px]" />
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)] gap-4">
                <Skeleton className="h-[360px]" />
                <Skeleton className="h-[360px]" />
              </div>
            </div>
          )}

          {data && (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)] gap-4">
              <div className="min-w-0">
                <EngagementAnalyticsChart summary={data.summary} engagement={data.engagement} />
              </div>
              <div className="min-w-0">
                <UserGrowthChart userGrowth={data.userGrowth} />
              </div>
              <div className="min-w-0">
                <TopStudentsTable students={data.topStudents} />
              </div>
              <div className="min-w-0">
                <SkillBreakdownChart skills={data.skills} />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
