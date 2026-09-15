import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  ClipboardX,
  Crown,
  Flame,
  Lock,
  Mail,
  Mic,
  Receipt,
  ShieldAlert,
  Target,
  TrendingUp,
  Unlock,
} from 'lucide-react';
import AdminSidebar from '../AdminSidebar';
import AdminHeader from '../AdminHeader';
import Modal from '../../shared/Modal';
import { authService } from '../../../services/authService';
import { handleAuthError } from '../../../services/apiError';
import {
  getStudentDetail,
  setStudentActiveStatus,
  AdminStudentDetail as AdminStudentDetailData,
} from '../../../services/adminStudentService';
import {
  learningGoalLabel,
  formatVnd,
  formatDateVi,
  formatDateTimeVi,
  formatStudyDuration,
  paymentStatusLabel,
  BADGE_BASE,
  positiveNegativeBadgeClass,
  planBadgeClass,
  neutralBadgeClass,
} from './adminStudentFormat';

// Sprint 15 — GET /admin students -> /admin/users/:id. Organized into the
// four sections the approved plan specified: Profile (A), Progress &
// results (B), Learning activity (C), Payments & PRO (D, read-only this
// sprint — no manual confirm/extend/refund, see UserController).
const AdminStudentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUserId = authService.getUser()?.id;

  const [data, setData] = useState<AdminStudentDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusAction, setStatusAction] = useState<'block' | 'unblock' | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    getStudentDetail(id)
      .then(setData)
      .catch((err) => setError(handleAuthError(err, navigate)))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmStatusChange = async () => {
    if (!id || !statusAction) return;
    setIsUpdatingStatus(true);
    setStatusError(null);
    try {
      await setStudentActiveStatus(id, statusAction === 'unblock');
      setStatusAction(null);
      load();
    } catch (err) {
      setStatusError(handleAuthError(err, navigate));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const isSelf = id === currentUserId;

  return (
    <div className="min-h-screen flex bg-[#fbfcfd]">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AdminHeader />

        <main className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6">
          <button
            onClick={() => navigate('/admin/users')}
            className="inline-flex items-center space-x-1.5 text-sm font-bold text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft size={16} />
            <span>Quay lại danh sách</span>
          </button>

          {isLoading && (
            <div className="space-y-4">
              <div className="h-24 bg-white border border-slate-100 rounded-3xl animate-pulse" />
              <div className="h-40 bg-white border border-slate-100 rounded-3xl animate-pulse" />
              <div className="h-40 bg-white border border-slate-100 rounded-3xl animate-pulse" />
            </div>
          )}

          {!isLoading && error && (
            <div className="bg-white border border-rose-100 rounded-3xl p-8 text-center space-y-3">
              <p className="text-sm font-semibold text-rose-600">{error}</p>
              <button
                onClick={load}
                className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-700"
              >
                Thử lại
              </button>
            </div>
          )}

          {!isLoading && !error && data && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* A. Hồ sơ học viên — profile summary card, left column (2026-09-15
                  feedback: was a full-width horizontal strip; the Level/Mục
                  tiêu labels read as cramped there because of the spread-out
                  layout, not the type itself). */}
              <section className="lg:col-span-1 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8 lg:sticky lg:top-24 space-y-6">
                <div className="flex flex-col items-center text-center">
                  <img
                    src={data.profile.avatarUrl || `https://picsum.photos/seed/${data.profile.id}/120/120`}
                    alt=""
                    className="w-20 h-20 rounded-2xl object-cover bg-slate-100 border border-slate-100"
                  />
                  <h1 className="text-xl font-black text-slate-900 mt-4">{data.profile.name}</h1>
                  <p className="flex items-center justify-center space-x-1.5 text-sm text-slate-500 font-medium mt-1.5">
                    <Mail size={14} />
                    <span className="truncate">{data.profile.email}</span>
                  </p>
                  <p className="flex items-center justify-center space-x-1.5 text-xs text-slate-400 font-medium mt-1.5">
                    <Calendar size={12} />
                    <span>Tham gia {formatDateVi(data.profile.createdAt)}</span>
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                    <span className={`${BADGE_BASE} ${positiveNegativeBadgeClass(data.profile.isActive)}`}>
                      {data.profile.isActive ? 'Active' : 'Blocked'}
                    </span>
                    <span className={`${BADGE_BASE} ${planBadgeClass(data.profile.isPro)}`}>
                      <Crown size={12} />
                      <span>{data.profile.isPro ? 'PRO' : 'Free'}</span>
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-50 pt-6 space-y-4">
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Level</p>
                    <p className="text-base font-black text-slate-800 mt-1">{data.profile.level}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Mục tiêu</p>
                    <p className="flex items-center space-x-1.5 text-sm font-bold text-slate-700 mt-1.5">
                      <Target size={14} className="text-slate-400" />
                      <span>{learningGoalLabel(data.profile.learningGoal)}</span>
                    </p>
                  </div>
                  {data.profile.isPro && data.profile.proExpiresAt && (
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Hạn PRO</p>
                      <p className="text-sm font-bold text-slate-700 mt-1.5">
                        {formatDateVi(data.profile.proExpiresAt)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  {isSelf ? (
                    <span
                      title="Không thể tự khóa/mở khóa tài khoản của chính mình"
                      className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-50 cursor-not-allowed"
                    >
                      <ShieldAlert size={14} />
                      <span>Tài khoản của bạn</span>
                    </span>
                  ) : data.profile.isActive ? (
                    <button
                      onClick={() => setStatusAction('block')}
                      className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition-all"
                    >
                      <Lock size={14} />
                      <span>Khóa tài khoản</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setStatusAction('unblock')}
                      className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
                    >
                      <Unlock size={14} />
                      <span>Mở khóa</span>
                    </button>
                  )}
                </div>
              </section>

              {/* Right column — progress, activity, billing, stacked */}
              <div className="lg:col-span-2 space-y-6">
              {/* B. Tiến độ & kết quả */}
              <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8 space-y-6">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Tiến độ &amp; kết quả</h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Tiến độ lộ trình</p>
                    {data.progress.progressPercent === null ? (
                      <p className="text-sm text-slate-400 font-medium">
                        {data.progress.hasRoadmap ? 'Lộ trình chưa có bài học nào' : 'Chưa tạo lộ trình học'}
                      </p>
                    ) : (
                      <>
                        <p className="text-2xl font-black text-slate-800">{data.progress.progressPercent}%</p>
                        <p className="text-xs text-slate-400 font-medium mt-1">
                          {data.progress.completedLessons}/{data.progress.totalLessons} bài học
                        </p>
                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mt-2">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${Math.min(100, data.progress.progressPercent)}%` }}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Điểm test trung bình</p>
                    <p className="text-2xl font-black text-slate-800">
                      {data.progress.averageTestScore === null ? '—' : `${data.progress.averageTestScore}%`}
                    </p>
                    <p className="text-xs text-slate-400 font-medium mt-1">
                      {data.progress.completedTestCount} bài đã làm
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center space-x-1">
                      <TrendingUp size={12} />
                      <span>Lịch sử test gần đây</span>
                    </p>
                    <p className="text-xs text-slate-400 font-medium">
                      {data.progress.recentTests.length} bài trong danh sách bên dưới
                    </p>
                  </div>
                </div>

                {data.progress.recentTests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-8">
                    <ClipboardX size={32} className="text-slate-200 mb-3" />
                    <p className="text-sm text-slate-400 font-medium">Học viên chưa làm bài kiểm tra nào.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="py-2 pr-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bài học</th>
                          <th className="py-2 pr-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Điểm</th>
                          <th className="py-2 pr-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kết quả</th>
                          <th className="py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ngày làm</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {data.progress.recentTests.map((test, i) => (
                          <tr key={i}>
                            <td className="py-2.5 pr-4">
                              <p className="font-bold text-slate-800">{test.taskTitle}</p>
                              <p className="text-xs text-slate-400">{test.lessonTitle}</p>
                            </td>
                            <td className="py-2.5 pr-4 font-bold text-slate-700">
                              {test.accuracyPercent}% ({test.correctCount}/{test.totalCount})
                            </td>
                            <td className="py-2.5 pr-4">
                              <span className={`${BADGE_BASE} ${positiveNegativeBadgeClass(test.passed)}`}>
                                {test.passed ? 'Đạt' : 'Chưa đạt'}
                              </span>
                            </td>
                            <td className="py-2.5 text-xs text-slate-400">{formatDateTimeVi(test.submittedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* C. Hoạt động học tập */}
              <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-6">Hoạt động học tập</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Tổng thời gian học</p>
                    <p className="text-2xl font-black text-slate-800">
                      {formatStudyDuration(data.activity.totalStudySeconds)}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center space-x-1">
                      <Flame size={12} />
                      <span>Streak hiện tại</span>
                    </p>
                    <p className="text-2xl font-black text-slate-800">{data.activity.currentStreakDays} ngày</p>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center space-x-1">
                      <Mic size={12} />
                      <span>Buổi luyện nói</span>
                    </p>
                    <p className="text-2xl font-black text-slate-800">
                      {data.activity.speakingSessionsCompleted}/{data.activity.speakingSessionsTotal}
                    </p>
                    <p className="text-xs text-slate-400 font-medium mt-1">đã hoàn thành</p>
                  </div>
                </div>
              </section>

              {/* D. Thanh toán & gói PRO — read-only, no manual confirm/extend/refund */}
              <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Thanh toán &amp; gói PRO</h2>
                  <span className={`${BADGE_BASE} ${planBadgeClass(data.billing.isPro)}`}>
                    <Crown size={12} />
                    <span>{data.billing.plan ?? 'Free'}</span>
                  </span>
                </div>

                {data.billing.payments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-8">
                    <Receipt size={32} className="text-slate-200 mb-3" />
                    <p className="text-sm text-slate-400 font-medium">Học viên chưa có giao dịch nào.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="py-2 pr-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mã đơn</th>
                          <th className="py-2 pr-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Số tiền</th>
                          <th className="py-2 pr-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trạng thái</th>
                          <th className="py-2 pr-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tạo lúc</th>
                          <th className="py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Thanh toán lúc</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {data.billing.payments.map((payment) => (
                          <tr key={payment.paymentCode}>
                            <td className="py-2.5 pr-4 font-mono text-xs font-bold text-slate-700">{payment.paymentCode}</td>
                            <td className="py-2.5 pr-4 font-bold text-slate-700">{formatVnd(payment.amount)}</td>
                            <td className="py-2.5 pr-4">
                              <span className={`${BADGE_BASE} ${neutralBadgeClass}`}>
                                {paymentStatusLabel[payment.status] ?? payment.status}
                              </span>
                            </td>
                            <td className="py-2.5 pr-4 text-xs text-slate-400">{formatDateTimeVi(payment.createdAt)}</td>
                            <td className="py-2.5 text-xs text-slate-400">
                              {payment.paidAt ? formatDateTimeVi(payment.paidAt) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {data.billing.paymentsTotal > data.billing.payments.length && (
                      <p className="text-[11px] text-slate-400 font-medium mt-3">
                        Hiển thị {data.billing.payments.length}/{data.billing.paymentsTotal} giao dịch gần nhất.
                      </p>
                    )}
                  </div>
                )}
              </section>
              </div>
            </div>
          )}
        </main>
      </div>

      {statusAction && (
        <Modal
          title={statusAction === 'block' ? 'Khóa tài khoản học viên?' : 'Mở khóa tài khoản học viên?'}
          onClose={() => (isUpdatingStatus ? undefined : setStatusAction(null))}
        >
          <div className="space-y-4">
            {statusError && (
              <div className="bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium px-4 py-3 rounded-xl">
                {statusError}
              </div>
            )}
            <p className="text-sm text-slate-600">
              {statusAction === 'block'
                ? 'Học viên sẽ không thể đăng nhập và mọi phiên đăng nhập hiện tại sẽ bị hủy trong tối đa 10 phút. Bạn có chắc chắn muốn khóa tài khoản này?'
                : 'Học viên sẽ có thể đăng nhập lại bình thường. Bạn có chắc chắn muốn mở khóa tài khoản này?'}
            </p>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setStatusAction(null)}
                disabled={isUpdatingStatus}
                className="px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={confirmStatusChange}
                disabled={isUpdatingStatus}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60 ${
                  statusAction === 'block' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isUpdatingStatus ? 'Đang xử lý...' : statusAction === 'block' ? 'Khóa tài khoản' : 'Mở khóa'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminStudentDetail;
