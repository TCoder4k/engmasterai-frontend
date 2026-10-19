import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, User, Mail, Save, Check, AlertCircle, CalendarDays, Clock, Crown, Zap } from 'lucide-react';
import { authService } from '../../services/authService';
import { getProfile, updateProfile, uploadAvatar } from '../../services/userService';
import { handleAuthError } from '../../services/apiError';
import { useTranslation } from '../../i18n/useTranslation';
import StudentLayout from '../user/StudentLayout';


interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: string;
  isPro: boolean;
  proStartsAt: string | null;
  proExpiresAt: string | null;
  isHocTap: boolean;
  hocTapStartsAt: string | null;
  hocTapExpiresAt: string | null;
}

// Serves both roles (the back link is role-aware), so it deliberately keeps
// its own standalone header rather than adopting the student sidebar shell.
const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const user = authService.getUser();

  const [profile, setProfile] = useState<UserProfile>({
    id: user?.id || '',
    name: user?.name || '',
    email: user?.email || '',
    avatarUrl: '',
    role: user?.role || 'USER',
    isPro: user?.isPro ?? false,
    proStartsAt: user?.proStartsAt ?? null,
    proExpiresAt: user?.proExpiresAt ?? null,
    isHocTap: user?.isHocTap ?? false,
    hocTapStartsAt: user?.hocTapStartsAt ?? null,
    hocTapExpiresAt: user?.hocTapExpiresAt ?? null,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Load user profile on mount
  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProfile = async () => {
    try {
      const userData = await getProfile();
      setProfile({
        id: userData.id,
        name: userData.name,
        email: userData.email,
        avatarUrl: userData.avatarUrl || '',
        role: userData.role,
        isPro: userData.isPro,
        proStartsAt: userData.proStartsAt,
        proExpiresAt: userData.proExpiresAt,
        isHocTap: userData.isHocTap,
        hocTapStartsAt: userData.hocTapStartsAt,
        hocTapExpiresAt: userData.hocTapExpiresAt,
      });
    } catch (err) {
      console.error('Failed to load profile:', err);
      setError(handleAuthError(err, navigate));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowedMimeTypes.includes(file.type)) {
      setError(t.avatar.onlyImages);
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError(t.avatar.tooLarge);
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload avatar
    setIsUploading(true);
    setError(null);

    try {
      const userData = await uploadAvatar(file);

      // Update profile state
      setProfile(prev => ({ ...prev, avatarUrl: userData.avatarUrl || '' }));
      setAvatarPreview(null);

      // Update local storage
      const currentUser = authService.getUser();
      if (currentUser) {
        const updatedUser = { ...currentUser, avatarUrl: userData.avatarUrl };
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      console.error('Avatar upload error:', err);
      setError(handleAuthError(err, navigate) || t.avatar.uploadFailed);
      setAvatarPreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Check what has changed
    const updates: any = {};
    const currentUser = authService.getUser();

    if (profile.name !== currentUser?.name) {
      updates.name = profile.name;
    }
    if (profile.email !== currentUser?.email) {
      updates.email = profile.email;
    }

    // Nothing to update
    if (Object.keys(updates).length === 0) {
      setError(t.profile.noChanges);
      return;
    }

    setIsLoading(true);

    try {
      const userData = await updateProfile(updates);

      // Update local storage with new data
      if (currentUser) {
        const updatedUser = {
          ...currentUser,
          name: userData.name,
          email: userData.email,
        };
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }

      // Update profile state
      setProfile(prev => ({
        ...prev,
        name: userData.name,
        email: userData.email,
      }));

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      console.error('Profile update error:', err);
      setError(handleAuthError(err, navigate) || t.common.loadFailed);
    } finally {
      setIsLoading(false);
    }
  };

  const getInitial = (name: string) => {
    return name?.charAt(0)?.toUpperCase() || 'U';
  };

  const formatExpiry = (value: string | null) =>
    value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(value)) : '—';

  const remainingDays = (value: string | null) =>
    value ? Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86400000)) : null;

  const subscriptionCards = [
    {
      key: 'pro',
      title: 'Gói Pro',
      active: profile.isPro,
      startsAt: profile.proStartsAt,
      expiry: profile.proExpiresAt,
      icon: Zap,
      tone: 'blue',
      description: 'Truy cập các tính năng AI nâng cao và luyện nói.',
    },
    {
      key: 'hoc-tap',
      title: 'Gói Học Tập',
      active: profile.isHocTap,
      startsAt: profile.hocTapStartsAt,
      expiry: profile.hocTapExpiresAt,
      icon: Crown,
      tone: 'amber',
      description: 'Mở khóa toàn bộ khóa học, bài học và thư viện từ vựng TOEIC 600.',
    },
  ];

  const profileContent = (
      <main className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="flex flex-col gap-4">
          <div className="mb-1">
            <h1 className="text-xl font-bold text-slate-900">{t.profile.title}</h1>
            <p className="mt-0.5 text-xs text-slate-500">{t.profile.subtitle}</p>
          </div>

          {/* Personal Information continuous card */}
          <section className="order-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col">
            {/* Profile Banner */}
            <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-500 to-blue-500 px-5 py-5 sm:px-6 sm:py-6">
              {/* Decorative gradient blur accents */}
              <div className="pointer-events-none absolute -right-10 -bottom-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
              <div className="pointer-events-none absolute right-1/3 -top-10 h-44 w-44 rounded-full bg-white/10 blur-xl" />

              <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                {/* Avatar with upload trigger */}
                <div className="relative shrink-0">
                  <div className="relative h-20 w-20 shrink-0 aspect-square overflow-hidden rounded-full border-4 border-white/40 bg-white/20 shadow-md sm:h-20 sm:w-20">
                    {isUploading && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 rounded-full">
                        <div className="h-8 w-8 animate-spin rounded-full border-3 border-white/30 border-t-white" />
                      </div>
                    )}
                    {avatarPreview || profile.avatarUrl ? (
                      <img
                        src={avatarPreview || profile.avatarUrl}
                        alt={profile.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-3xl sm:text-4xl font-bold text-white">
                        {getInitial(profile.name)}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleAvatarClick}
                    disabled={isUploading}
                    aria-label={t.avatarMenu.changePhoto}
                    title={t.avatarMenu.changePhoto}
                    className="absolute -bottom-1.5 -right-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-white text-blue-600 shadow-md border border-slate-100 transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Camera size={15} />
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/jpg,image/webp"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </div>

                {/* User Info */}
                <div className="min-w-0 text-white">
                  <h2 className="text-xl font-bold tracking-tight truncate">
                    {profile.name || user?.name}
                  </h2>
                  <p className="mt-0.5 text-xs text-blue-100 truncate">
                    {profile.email || user?.email}
                  </p>
                  <div className="mt-2">
                    <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                      {profile.role === 'ADMIN' ? t.roles.admin : t.roles.student}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Form Section below banner */}
            <form onSubmit={handleSubmit} className="p-5 sm:p-6">
              <div>
                {/* Form header */}
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shrink-0">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Thông tin cá nhân
                    </h3>
                    <p className="text-xs text-slate-500">
                      Cập nhật thông tin cá nhân của bạn
                    </p>
                  </div>
                </div>

                {/* Success Message */}
                {isSaved && (
                  <div className="mb-6 flex items-center space-x-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check size={16} className="text-white" />
                    </div>
                    <p className="text-sm font-medium text-emerald-700">
                      {t.profile.saved}
                    </p>
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="mb-6 flex items-center space-x-3 p-4 bg-rose-50 border border-rose-200 rounded-xl">
                    <div className="w-8 h-8 bg-rose-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <AlertCircle size={16} className="text-white" />
                    </div>
                    <p className="text-sm font-medium text-rose-700">{error}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Display Name */}
                  <div>
                    <label htmlFor="name" className="mb-1.5 block text-xs font-semibold text-slate-900">
                      {t.profile.displayName}
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={profile.name}
                        onChange={handleInputChange}
                        placeholder={t.profile.displayNamePlaceholder}
                        className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {t.profile.displayNameHint}
                    </p>
                  </div>

                  {/* Email (Read-only) */}
                  <div>
                    <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-slate-900">
                      {t.profile.email}
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={profile.email}
                        readOnly
                        disabled
                        className="h-10 w-full rounded-lg border border-slate-200 bg-slate-100 pl-9 pr-3 text-xs font-medium text-slate-600 cursor-not-allowed"
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {t.profile.emailHint}
                    </p>
                  </div>
                </div>
              </div>

              {/* Submit Button aligned bottom-right */}
              <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      <span>{t.profile.saving}</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-5 w-5" />
                      <span>{t.profile.saveChanges}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>

          <section className="order-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-5">
              <h3 className="text-base font-bold text-slate-900">Thông tin gói của bạn</h3>
              <p className="mt-1 text-xs text-slate-500">
                Các gói đang sử dụng và thời hạn được cập nhật từ hệ thống.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {subscriptionCards.map((subscription) => {
                const Icon = subscription.icon;
                const days = remainingDays(subscription.expiry);
                return (
                  <div
                    key={subscription.key}
                    className={`rounded-2xl border p-4 ${
                      subscription.tone === 'amber'
                        ? 'border-amber-200 bg-amber-50/40'
                        : 'border-blue-200 bg-blue-50/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                          subscription.tone === 'amber' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                        }`}>
                          <Icon size={20} />
                        </span>
                        <h4 className="font-bold text-slate-900">{subscription.title}</h4>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        subscription.active
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {subscription.active ? 'Đang hoạt động' : 'Chưa có'}
                      </span>
                    </div>
                    <p className="mt-3 min-h-10 text-[11px] leading-4 text-slate-500">{subscription.description}</p>
                    <dl className="mt-3 space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between gap-3">
                        <dt className="flex items-center gap-2 text-slate-500"><CalendarDays size={14} /> Ngày bắt đầu</dt>
                        <dd className="font-semibold text-slate-700">
                          {subscription.active ? formatExpiry(subscription.startsAt) : '—'}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="flex items-center gap-2 text-slate-500"><CalendarDays size={14} /> Ngày hết hạn</dt>
                        <dd className="font-semibold text-slate-700">{subscription.active ? formatExpiry(subscription.expiry) : '—'}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="flex items-center gap-2 text-slate-500"><Clock size={14} /> Thời gian còn lại</dt>
                        <dd className="font-semibold text-slate-700">
                          {days !== null && subscription.active ? `${days} ngày` : '—'}
                        </dd>
                      </div>
                    </dl>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>

  );

  return profile.role === 'ADMIN' ? (
    <div className="min-h-screen bg-slate-50 text-slate-900">{profileContent}</div>
  ) : (
    <StudentLayout>{profileContent}</StudentLayout>
  );
};

export default ProfilePage;
