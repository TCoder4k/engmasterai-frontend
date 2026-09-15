import { LearningGoal } from '../../../types';

// Sprint 15 — shared, tiny formatting helpers for AdminUsers.tsx and
// AdminStudentDetail.tsx, kept in one place so the two pages never drift on
// how the same field is displayed. Admin pages in this codebase are plain
// hardcoded Vietnamese strings, not routed through the i18n dictionary (only
// student-facing pages use useTranslation()) — this file follows that
// existing convention rather than introducing i18n here.

const LEARNING_GOAL_LABELS: Record<LearningGoal, string> = {
  FOUNDATION: 'Nền tảng',
  TOEIC_450: 'TOEIC 450+',
  TOEIC_650: 'TOEIC 650+',
  TOEIC_800: 'TOEIC 800+',
  GENERAL_ENGLISH: 'Tiếng Anh giao tiếp',
  REGULAR_PRACTICE: 'Luyện tập đều đặn',
};

export const learningGoalLabel = (goal: LearningGoal | null): string =>
  goal ? (LEARNING_GOAL_LABELS[goal] ?? goal) : 'Chưa chọn';

export const formatVnd = (amount: number): string =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

export const formatDateVi = (iso: string): string => new Date(iso).toLocaleDateString('vi-VN');

export const formatDateTimeVi = (iso: string): string => new Date(iso).toLocaleString('vi-VN');

// Whole hours + minutes — "2h 15p" / "45p" / "0p". Total study time is
// stored in seconds (StudyTimeEvent.creditedSeconds); admins care about
// hours/minutes, not raw seconds.
export const formatStudyDuration = (totalSeconds: number): string => {
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}p` : `${minutes}p`;
};

export const paymentStatusLabel: Record<string, string> = {
  PENDING: 'Đang chờ',
  PAID: 'Đã thanh toán',
  CANCELLED: 'Đã hủy',
  REFUNDED: 'Đã hoàn tiền',
};

// Shared badge look for both admin pages (2026-09-15 design feedback: the
// old bg-*-50/text-*-600 pills read as too small and too bright — softened
// with rounded-md, a matching pastel ring, and semibold instead of bold).
export const BADGE_BASE =
  'inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wide';

export const positiveNegativeBadgeClass = (isPositive: boolean): string =>
  isPositive
    ? 'bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100'
    : 'bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-100';

export const planBadgeClass = (isPro: boolean): string =>
  isPro
    ? 'bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100'
    : 'bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200';

export const neutralBadgeClass =
  'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-100';
