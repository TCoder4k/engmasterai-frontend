import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Flame } from 'lucide-react';
import StudentLayout from '../../user/StudentLayout';
import BackButton from '../BackButton';
import ErrorState from '../ErrorState';
import Skeleton from '../Skeleton';
import { useTranslation } from '../../../i18n/useTranslation';
import { authService } from '../../../services/authService';
import { handleAuthError } from '../../../services/apiError';
import { getStreakDetail, type StreakDetail } from '../../../services/streakService';
import CommunityAvatar from '../assistant/community-chat/CommunityAvatar';
import StreakCalendar from './StreakCalendar';
import ShareStreakModal from './ShareStreakModal';

type LoadState = 'loading' | 'ready' | 'error';

const activityLabel = (
  t: ReturnType<typeof useTranslation>['t'],
  activity: StreakDetail['meActivityToday'],
): string | null => {
  if (!activity.qualified || !activity.label) return null;
  const label =
    activity.label === 'lesson'
      ? t.streak.activityLesson
      : activity.label === 'practice'
        ? t.streak.activityPractice
        : t.streak.activityVocab;
  const time = activity.at
    ? new Date(activity.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : '';
  return time ? `${label} · ${time}` : label;
};

// The Streak Detail view (Sprint — Streak Together, §F) — a FULL PAGE inside
// the existing sidebar shell, not a cramped popover/modal, per the approved
// visual reference (the mockup showed it alongside the full desktop
// sidebar). Follows the same load/error/content shape every other detail
// page in this app uses (WordDetailPage, DeckDetailPage, etc).
const StreakDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const currentUser = authService.getUser();

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [streak, setStreak] = useState<StreakDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const load = () => {
    if (!id) return;
    setLoadState('loading');
    getStreakDetail(id)
      .then((result) => {
        setStreak(result);
        setLoadState('ready');
      })
      .catch((err) => {
        setError(handleAuthError(err, navigate) || t.streak.loadError);
        setLoadState('error');
      });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [id]);

  return (
    <StudentLayout>
      <BackButton to="/streaks" label={t.streak.backToList} className="mb-6" />

      {loadState === 'loading' && (
        <div className="space-y-4" aria-hidden="true">
          <Skeleton className="h-40 w-full rounded-3xl" />
          <Skeleton className="h-24 w-full rounded-3xl" />
        </div>
      )}

      {loadState === 'error' && <ErrorState message={error ?? t.streak.loadError} onRetry={load} />}

      {loadState === 'ready' && streak && (
        <div className="grid lg:grid-cols-[1fr,280px] gap-6">
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-lg dark:shadow-none dark:border dark:border-slate-800 p-8 text-center">
              <div className="flex items-center justify-center gap-4 mb-4">
                <CommunityAvatar name={currentUser?.name ?? t.streak.you} avatarUrl={currentUser?.avatarUrl ?? null} size={56} />
                <Flame size={24} className="text-orange-500" aria-hidden="true" />
                <CommunityAvatar name={streak.partner.name} avatarUrl={streak.partner.avatarUrl} size={56} />
              </div>
              <div className="flex items-center justify-center gap-2 mb-1">
                <Flame size={28} className="text-orange-500 fill-orange-500" aria-hidden="true" />
                <span className="text-4xl font-extrabold text-slate-900 dark:text-white">
                  {t.streak.dayCount(streak.currentStreak)}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                {t.streak.withPartner(streak.partner.name)}
              </p>

              <StreakCalendar days={streak.calendar} locale={language} />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow dark:shadow-none dark:border dark:border-slate-800 p-4">
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">{t.streak.you}</p>
                <p
                  className={`text-sm font-bold ${
                    streak.meActivityToday.qualified
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {streak.meActivityToday.qualified ? t.streak.studiedToday : t.streak.notStudiedToday}
                </p>
                {activityLabel(t, streak.meActivityToday) && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {activityLabel(t, streak.meActivityToday)}
                  </p>
                )}
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow dark:shadow-none dark:border dark:border-slate-800 p-4">
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">
                  {streak.partner.name}
                </p>
                <p
                  className={`text-sm font-bold ${
                    streak.partnerActivityToday.qualified
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {streak.partnerActivityToday.qualified ? t.streak.studiedToday : t.streak.notStudiedToday}
                </p>
                {activityLabel(t, streak.partnerActivityToday) && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {activityLabel(t, streak.partnerActivityToday)}
                  </p>
                )}
              </div>
            </div>

            <div
              className={`rounded-2xl px-4 py-3 text-center text-sm font-bold ${
                streak.status === 'ACTIVE'
                  ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}
            >
              {streak.status === 'ACTIVE' ? t.streak.activeStatus : t.streak.brokenLabel}
            </div>
          </div>

          <aside className="bg-white dark:bg-slate-900 rounded-2xl shadow dark:shadow-none dark:border dark:border-slate-800 p-5 h-fit space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t.streak.infoTitle}</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">{t.streak.startedAt}</dt>
                <dd className="font-semibold text-slate-900 dark:text-white">
                  {new Date(streak.startedAt).toLocaleDateString(language)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">{t.streak.longestStreak}</dt>
                <dd className="font-semibold text-slate-900 dark:text-white">{t.streak.dayCount(streak.longestStreak)}</dd>
              </div>
              {streak.percentileRank !== null && (
                <div className="flex justify-between">
                  <dt className="text-slate-500 dark:text-slate-400">{t.streak.rank}</dt>
                  <dd className="font-semibold text-slate-900 dark:text-white">{t.streak.topPercent(streak.percentileRank)}</dd>
                </div>
              )}
            </dl>
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="w-full rounded-xl bg-orange-500 text-white font-bold py-2.5 text-sm hover:bg-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
            >
              {t.streak.share}
            </button>
          </aside>
        </div>
      )}

      {shareOpen && streak && (
        <ShareStreakModal
          streakId={streak.id}
          partnerName={streak.partner.name}
          currentStreak={streak.currentStreak}
          onClose={() => setShareOpen(false)}
        />
      )}
    </StudentLayout>
  );
};

export default StreakDetailPage;
