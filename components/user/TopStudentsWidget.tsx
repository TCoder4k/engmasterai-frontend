import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { getTopStudents, type PublicTopStudent } from '../../services/analyticsService';

const RANK_GLYPH: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

const AVATAR_PALETTE = [
  'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
  'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  'bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400',
  'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
  'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
];

// Deterministic color per student id — no real avatar image source exists
// here (this is a leaderboard row, not a profile), so this is an initials
// avatar, same idea as the admin-only TopStudentsTable.tsx's own Avatar
// (reimplemented locally, with dark-mode classes, rather than importing an
// admin-namespaced component into student-facing code).
const Avatar: React.FC<{ id: string; name: string }> = ({ id, name }) => {
  const hash = Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const palette = AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <span
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${palette}`}
    >
      {initial}
    </span>
  );
};

// Zero-padded minutes ("2h 05m") — duplicated from TopStudentsTable.tsx's
// own tiny pure formatter rather than extracted, matching this codebase's
// stated convention for small formatters this size.
const formatSeconds = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
};

// Student-facing sibling of the admin dashboard's TopStudentsTable — same
// all-time study-time ranking (GET /analytics/top-students, not role-gated),
// but the response has no email field at all: a fellow student must never
// see another student's email address. Self-fetches on mount, same
// undefined/null/array loading state machine as DuoLeaderboardWidget.tsx.
const TopStudentsWidget: React.FC = () => {
  const { t } = useTranslation();
  const [students, setStudents] = useState<PublicTopStudent[] | null | undefined>(undefined);

  const load = () => {
    setStudents(undefined);
    getTopStudents()
      .then(setStudents)
      .catch(() => setStudents(null));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  return (
    <section
      aria-label={t.widgets.topStudentsTitle}
      className="p-6 bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 rounded-3xl shadow-sm dark:shadow-xl space-y-4"
    >
      <div className="flex items-center gap-3">
        <img
          src="/logo/trophy-cup.jpg"
          alt=""
          aria-hidden="true"
          className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
        />
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider truncate">
            {t.widgets.topStudentsTitle}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate">
            {t.widgets.topStudentsSubtitle}
          </p>
        </div>
      </div>

      {students === undefined && (
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-14 rounded-2xl bg-slate-100 dark:bg-ink-950 animate-pulse" />
          ))}
        </div>
      )}

      {students === null && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-rose-500 dark:text-rose-400">{t.widgets.statsUnavailable}</p>
          <button
            type="button"
            onClick={load}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {t.widgets.statsRetry}
          </button>
        </div>
      )}

      {students !== undefined && students !== null && students.length === 0 && (
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{t.widgets.topStudentsEmpty}</p>
      )}

      {students !== undefined && students !== null && students.length > 0 && (
        <ul className="space-y-2">
          {students.map((student, index) => {
            const rank = index + 1;
            return (
              <li
                key={student.id}
                className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50 dark:bg-ink-950 border border-slate-100 dark:border-ink-700"
              >
                <span className="w-5 text-center text-sm font-bold text-slate-400 dark:text-slate-500 shrink-0" aria-hidden="true">
                  {RANK_GLYPH[rank] ?? rank}
                </span>
                <Avatar id={student.id} name={student.name} />
                <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-900 dark:text-white">
                  {student.name}
                </span>
                <span className="shrink-0 text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                  {formatSeconds(student.totalStudySeconds)}
                </span>
                <span className="shrink-0 text-[11px] font-semibold text-slate-400 dark:text-slate-500 tabular-nums hidden sm:inline">
                  {t.widgets.topStudentsTasksCount(student.completedTasks)}
                </span>
                <span className="shrink-0 rounded-full bg-violet-50 dark:bg-violet-500/10 px-2 py-1 text-[10px] font-bold text-violet-600 dark:text-violet-400">
                  Lv {student.level}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default TopStudentsWidget;
