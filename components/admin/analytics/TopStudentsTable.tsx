import React from 'react';
import type { AdminTopStudent } from '../../../services/adminAnalyticsService';

interface TopStudentsTableProps {
  students: AdminTopStudent[];
}

// Literal class names, not `text-${align}` — Tailwind's JIT scanner only
// picks up complete class strings that appear verbatim in source.
const ALIGN_CLASS: Record<'left' | 'right' | 'center', string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

const TableHeading: React.FC<{ children: React.ReactNode; align?: 'left' | 'right' | 'center' }> = ({
  children,
  align = 'left',
}) => (
  <th
    className={`px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 ${ALIGN_CLASS[align]}`}
  >
    {children}
  </th>
);

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

const RankBadge: React.FC<{ rank: number }> = ({ rank }) => {
  const medal = MEDALS[rank];
  const style =
    rank === 1
      ? 'bg-amber-100 text-amber-600'
      : rank === 2
        ? 'bg-slate-200 text-slate-600'
        : rank === 3
          ? 'bg-orange-100 text-orange-600'
          : 'bg-slate-50 text-slate-500';

  return (
    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${style}`}>
      {medal ?? rank}
    </span>
  );
};

const AVATAR_PALETTE = [
  'bg-blue-100 text-blue-600',
  'bg-emerald-100 text-emerald-600',
  'bg-orange-100 text-orange-600',
  'bg-violet-100 text-violet-600',
  'bg-rose-100 text-rose-600',
];

// Deterministic color per student id — no real avatar image source exists,
// so this is an initials avatar, not a stand-in for real profile data.
const Avatar: React.FC<{ id: string; name: string }> = ({ id, name }) => {
  const hash = Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const palette = AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${palette}`}>
      {initial}
    </span>
  );
};

// Zero-padded minutes ("2h 05m") — a bare "2h 5m" reads inconsistently next
// to other 2-digit fields in the same row.
const formatSeconds = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
};

const TOP_STUDENTS_SLOTS = 5;

// Ranked by SUM(StudyTimeEvent.creditedSeconds), all time — see
// admin-dashboard-analytics.service.ts's getTopStudents(). "Bài tập hoàn
// thành" is task-level (LessonTaskProgress), deliberately not "bài học" —
// lesson-level completion needs the full stage-derivation invariant, too
// expensive to run per row for a top-5 ranking widget.
const TopStudentsTable: React.FC<TopStudentsTableProps> = ({ students }) => (
  <section className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden h-full">
    <div className="p-6 border-b border-slate-50">
      <h3 className="font-bold text-slate-900">Top Học viên chăm chỉ</h3>
      <p className="text-xs text-slate-400 font-medium mt-1">Xếp hạng theo tổng thời gian học</p>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-slate-50/50">
            <TableHeading>Hạng</TableHeading>
            <TableHeading>Học viên</TableHeading>
            <TableHeading align="center">Tổng thời gian học</TableHeading>
            <TableHeading align="center">Bài tập hoàn thành</TableHeading>
            <TableHeading align="right">Cấp độ</TableHeading>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {students.length === 0 && (
            <tr>
              <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-400 font-medium">
                Chưa có dữ liệu học tập nào.
              </td>
            </tr>
          )}
          {students.map((student, index) => (
            <tr key={student.id} className="hover:bg-slate-50/30 transition-colors">
              <td className="px-4 py-3">
                <RankBadge rank={index + 1} />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar id={student.id} name={student.name} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{student.name}</p>
                    <p className="truncate text-[11px] text-slate-400">{student.email}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-center text-sm font-semibold text-slate-700">
                {formatSeconds(student.totalStudySeconds)}
              </td>
              <td className="px-4 py-3 text-center text-sm font-semibold text-slate-700">
                {student.completedTasks} bài
              </td>
              <td className="px-4 py-3 text-right">
                <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-600">
                  Level {student.level}
                </span>
              </td>
            </tr>
          ))}
          {/* Empty ranking slots when fewer than 5 students exist — muted
              skeleton bars and dashes only, never a fabricated name/number. */}
          {students.length > 0 &&
            Array.from({ length: Math.max(0, TOP_STUDENTS_SLOTS - students.length) }).map((_, i) => (
              <tr key={`placeholder-${i}`} className="opacity-40">
                <td className="px-4 py-3">
                  <RankBadge rank={students.length + i + 1} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="h-9 w-9 shrink-0 rounded-full bg-slate-100" />
                    <div className="space-y-1.5">
                      <div className="h-2.5 w-24 rounded bg-slate-100" />
                      <div className="h-2 w-32 rounded bg-slate-100" />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center text-sm text-slate-300">—</td>
                <td className="px-4 py-3 text-center text-sm text-slate-300">—</td>
                <td className="px-4 py-3 text-right text-xs text-slate-300">—</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  </section>
);

export default TopStudentsTable;
