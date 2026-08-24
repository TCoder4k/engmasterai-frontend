import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Flame, Heart } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';
import { authService } from '../../../services/authService';
import { getPublicStreak, type PublicStreak } from '../../../services/streakService';
import { Logo } from '../Logo';
import CommunityAvatar from '../assistant/community-chat/CommunityAvatar';

type LoadState = 'loading' | 'ready' | 'error';

// PUBLIC, unauthenticated page — the first of its kind in this app outside
// /login-adjacent routes. Deliberately minimal (matches the approved visual
// reference exactly): streak count + both display names only, no calendar,
// no activity history, no internal ids — the backend's own dedicated public
// projection already guarantees that server-side, and this page adds no
// extra fields on top of what GET /streaks/public/:shareId returns.
//
// Bot-facing link previews (Facebook/Zalo/Messenger/etc.) are served by a
// separate Vercel Edge Middleware (see /middleware.ts at the repo root) that
// intercepts THIS SAME URL for known crawler user-agents before it ever
// reaches this client-rendered SPA route — real visitors always land here.
const PublicStreakPage: React.FC = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const { t } = useTranslation();
  const isLoggedIn = Boolean(authService.getToken());

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [streak, setStreak] = useState<PublicStreak | null>(null);

  useEffect(() => {
    if (!shareId) return;
    getPublicStreak(shareId)
      .then((result) => {
        setStreak(result);
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  }, [shareId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-orange-950 to-slate-900 px-4 py-12">
      <div className="w-full max-w-sm text-center">
        {loadState === 'loading' && (
          <div className="text-white/60 text-sm" aria-hidden="true">
            {t.streak.publicLoading}
          </div>
        )}

        {loadState === 'error' && <div className="text-white/70 text-sm">{t.streak.publicNotFound}</div>}

        {loadState === 'ready' && streak && (
          <>
            <div className="flex items-center justify-center gap-4 mb-6">
              <CommunityAvatar name={streak.userA.name} avatarUrl={streak.userA.avatarUrl} size={64} />
              <Heart size={22} className="text-rose-400 fill-rose-400" aria-hidden="true" />
              <CommunityAvatar name={streak.userB.name} avatarUrl={streak.userB.avatarUrl} size={64} />
            </div>

            <div className="flex items-center justify-center gap-2 mb-2">
              <Flame size={36} className="text-orange-400 fill-orange-400" aria-hidden="true" />
              <span className="text-5xl font-extrabold text-white">{streak.currentStreak}</span>
              <span className="text-2xl font-bold text-white/80">{t.streak.publicDaysUnit}</span>
            </div>

            <p className="text-white/80 text-sm mb-8">{t.streak.publicTagline}</p>
          </>
        )}

        <div className="mt-4">
          <Link
            to={isLoggedIn ? '/streaks' : '/register'}
            className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 hover:bg-orange-400 text-white font-bold px-6 py-3.5 text-sm transition-colors"
          >
            <Flame size={16} aria-hidden="true" />
            {t.streak.publicCta}
          </Link>
        </div>

        <div className="mt-10 flex items-center justify-center gap-2 opacity-70">
          <Logo size="sm" variant="inverted" />
        </div>
      </div>
    </div>
  );
};

export default PublicStreakPage;
