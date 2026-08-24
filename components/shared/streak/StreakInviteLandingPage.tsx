import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Flame } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';
import { authService } from '../../../services/authService';
import { ApiError } from '../../../services/apiError';
import {
  acceptInviteLink,
  getInviteLinkPreview,
  type StreakInviteLinkPreview,
} from '../../../services/streakService';
import { Logo } from '../Logo';
import CommunityAvatar from '../assistant/community-chat/CommunityAvatar';

type LoadState = 'loading' | 'ready' | 'error';
type JoinState = 'idle' | 'joining' | 'ownLink' | 'error';

// PUBLIC, unauthenticated — the entry point for Streak Together's
// persistent invite link (distinct from /streak/:shareId's PublicStreakPage
// above, which only CELEBRATES an already-active streak; this page is what
// CREATES a pair). Handles both auth states itself rather than being
// wrapped in ProtectedRoute, so it can carry an unauthenticated visitor
// through /login or /register and back via `state.from` — the first place
// in this app that hands off an intended destination across the auth flow
// (see LoginForm/RegisterForm's enterSession for the other half of this).
//
// Whether this link is the viewer's own is deliberately NOT guessed
// client-side (the public preview intentionally has no id to compare
// against — same narrow-projection discipline as PublicStreakDto). The
// backend's 400 on a self-join is the single source of truth; this page
// just renders that outcome.
const StreakInviteLandingPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isLoggedIn = Boolean(authService.getToken());

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [preview, setPreview] = useState<StreakInviteLinkPreview | null>(null);
  const [joinState, setJoinState] = useState<JoinState>('idle');

  useEffect(() => {
    if (!token) return;
    getInviteLinkPreview(token)
      .then((result) => {
        setPreview(result);
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  }, [token]);

  const handleJoin = async () => {
    if (!token) return;
    setJoinState('joining');
    try {
      const pair = await acceptInviteLink(token);
      navigate(`/streaks/${pair.id}`);
    } catch (err) {
      setJoinState(err instanceof ApiError && err.status === 400 ? 'ownLink' : 'error');
    }
  };

  const authState = { from: `/invite/${token ?? ''}` };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-orange-950 to-slate-900 px-4 py-12">
      <div className="w-full max-w-sm text-center">
        {loadState === 'loading' && (
          <div className="text-white/60 text-sm" aria-hidden="true">
            {t.streak.publicLoading}
          </div>
        )}

        {loadState === 'error' && (
          <>
            <div className="text-white/70 text-sm mb-6">{t.streak.inviteLinkNotFound}</div>
            <Link
              to="/streaks"
              className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 hover:bg-orange-400 text-white font-bold px-6 py-3.5 text-sm transition-colors"
            >
              {t.streak.backToList}
            </Link>
          </>
        )}

        {loadState === 'ready' && preview && (
          <>
            <div className="flex items-center justify-center mb-6">
              <CommunityAvatar name={preview.inviterName} avatarUrl={preview.inviterAvatarUrl} size={72} />
            </div>

            <div className="flex items-center justify-center gap-2 mb-3">
              <Flame size={28} className="text-orange-400 fill-orange-400" aria-hidden="true" />
              <h1 className="text-xl font-extrabold text-white">{t.streak.inviteLinkFrom(preview.inviterName)}</h1>
            </div>

            {!isLoggedIn && (
              <>
                <p className="text-white/70 text-sm mb-6">{t.streak.inviteLinkPrompt}</p>
                <div className="flex items-center justify-center gap-3">
                  <Link
                    to="/login"
                    state={authState}
                    className="inline-flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold px-5 py-3 text-sm transition-colors border border-white/20"
                  >
                    {t.streak.inviteLinkLogin}
                  </Link>
                  <Link
                    to="/register"
                    state={authState}
                    className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 hover:bg-orange-400 text-white font-bold px-5 py-3 text-sm transition-colors"
                  >
                    {t.streak.inviteLinkRegister}
                  </Link>
                </div>
              </>
            )}

            {isLoggedIn && joinState === 'ownLink' && (
              <p className="text-white/70 text-sm">{t.streak.inviteLinkOwnLink}</p>
            )}

            {isLoggedIn && joinState !== 'ownLink' && (
              <>
                {joinState === 'error' && (
                  <p className="text-rose-300 text-sm mb-3">{t.streak.inviteLinkJoinError}</p>
                )}
                <button
                  type="button"
                  onClick={handleJoin}
                  disabled={joinState === 'joining'}
                  className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 hover:bg-orange-400 text-white font-bold px-6 py-3.5 text-sm transition-colors disabled:opacity-60"
                >
                  <Flame size={16} aria-hidden="true" />
                  {joinState === 'joining' ? t.streak.inviteLinkJoining : t.streak.inviteLinkJoin}
                </button>
              </>
            )}
          </>
        )}

        <div className="mt-10 flex items-center justify-center gap-2 opacity-70">
          <Logo size="sm" variant="inverted" />
        </div>
      </div>
    </div>
  );
};

export default StreakInviteLandingPage;
