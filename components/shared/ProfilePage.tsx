import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, User, Mail, Save, Check, AlertCircle } from 'lucide-react';
import { authService } from '../../services/authService';
import { getProfile, updateProfile, uploadAvatar } from '../../services/userService';
import { handleAuthError } from '../../services/apiError';
import { useTranslation } from '../../i18n/useTranslation';
import ReferralCard from '../user/ReferralCard';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: string;
  isPro: boolean;
  proExpiresAt: string | null;
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
    proExpiresAt: user?.proExpiresAt ?? null,
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
        proExpiresAt: userData.proExpiresAt,
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

  const getBackLink = () => {
    return profile.role === 'ADMIN' ? '/admin' : '/home';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16 lg:pb-12">
      {/* Header Container — aligned with main content max-width */}
      <header className="mx-auto w-full max-w-[1400px] px-4 pt-5 sm:px-6 sm:pt-6 lg:px-8">
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:px-6">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Link
              to={getBackLink()}
              aria-label={t.common.back}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                {t.profile.title}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 truncate">
                {t.profile.subtitle}
              </p>
            </div>
          </div>

          <Link to={getBackLink()} className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-base shadow-sm">
              E
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900 hidden sm:block">
              Engmaster<span className="text-blue-600">AI</span>
            </span>
          </Link>
        </div>
      </header>

      {/* Main Content — 60/40 two-column layout on >=lg */}
      <main className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)] xl:gap-6">
          {/* LEFT 60%: Personal Information continuous card */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col">
            {/* Profile Banner */}
            <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-500 to-blue-500 px-6 py-8 sm:px-8 sm:py-9">
              {/* Decorative gradient blur accents */}
              <div className="pointer-events-none absolute -right-10 -bottom-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
              <div className="pointer-events-none absolute right-1/3 -top-10 h-44 w-44 rounded-full bg-white/10 blur-xl" />

              <div className="relative flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
                {/* Avatar with upload trigger */}
                <div className="relative shrink-0">
                  <div className="relative h-24 w-24 sm:h-28 sm:w-28 overflow-hidden rounded-2xl border-4 border-white/40 bg-white/20 shadow-md">
                    {isUploading && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 rounded-2xl">
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
                    className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-600 shadow-md border border-slate-100 transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Camera size={18} />
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
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">
                    {profile.name || user?.name}
                  </h2>
                  <p className="mt-1 text-sm text-blue-100 truncate">
                    {profile.email || user?.email}
                  </p>
                  <div className="mt-3">
                    <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs sm:text-sm font-medium text-white backdrop-blur-sm">
                      {profile.role === 'ADMIN' ? t.roles.admin : t.roles.student}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Form Section below banner */}
            <form onSubmit={handleSubmit} className="flex-1 p-6 sm:p-8 flex flex-col justify-between">
              <div>
                {/* Form header */}
                <div className="mb-7 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shrink-0">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Thông tin cá nhân
                    </h3>
                    <p className="text-sm text-slate-500">
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

                <div className="space-y-6">
                  {/* Display Name */}
                  <div>
                    <label htmlFor="name" className="block text-sm font-semibold text-slate-900 mb-2">
                      {t.profile.displayName}
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={profile.name}
                        onChange={handleInputChange}
                        placeholder={t.profile.displayNamePlaceholder}
                        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      {t.profile.displayNameHint}
                    </p>
                  </div>

                  {/* Email (Read-only) */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-slate-900 mb-2">
                      {t.profile.email}
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={profile.email}
                        readOnly
                        disabled
                        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-100 pl-11 pr-4 text-sm font-medium text-slate-600 cursor-not-allowed"
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      {t.profile.emailHint}
                    </p>
                  </div>
                </div>
              </div>

              {/* Submit Button aligned bottom-right */}
              <div className="mt-8 flex justify-end">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex h-12 items-center gap-2 rounded-xl bg-blue-600 px-6 font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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

          {/* RIGHT 40%: Referral / Invite Friends card */}
          <ReferralCard />
        </div>
      </main>

      {/* Footer */}
      <footer className="mx-auto w-full max-w-[1400px] px-4 pt-6 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© 2024 EngmasterAI. Cùng bạn chinh phục tiếng Anh mỗi ngày!</p>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-slate-600 transition-colors">Điều khoản</a>
            <span>|</span>
            <a href="#" className="hover:text-slate-600 transition-colors">Bảo mật</a>
            <span>|</span>
            <a href="#" className="hover:text-slate-600 transition-colors">Liên hệ</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ProfilePage;
