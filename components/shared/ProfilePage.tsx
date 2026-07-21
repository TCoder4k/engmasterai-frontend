import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, User, Mail, Save, Check, AlertCircle } from 'lucide-react';
import { authService } from '../../services/authService';
import { getProfile, updateProfile, uploadAvatar } from '../../services/userService';
import { handleAuthError } from '../../services/apiError';
import { useTranslation } from '../../i18n/useTranslation';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: string;
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
              <Link
                to={getBackLink()}
                aria-label={t.common.back}
                className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:text-slate-500 dark:hover:text-indigo-400 dark:hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
              >
                <ArrowLeft size={20} />
              </Link>
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">{t.profile.title}</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{t.profile.subtitle}</p>
              </div>
            </div>
            <Link to={getBackLink()} className="flex items-center space-x-2 flex-shrink-0">
              <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">E</span>
              </div>
              <span className="text-lg font-bold text-slate-900 dark:text-white hidden sm:block">
                Engmaster<span className="text-indigo-500">AI</span>
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
          {/* Profile Header */}
          <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 sm:px-8 py-10">
            <div className="flex flex-col sm:flex-row items-center sm:items-end space-y-4 sm:space-y-0 sm:space-x-6">
              {/* Avatar */}
              <div className="relative group">
                <div className="w-28 h-28 rounded-2xl overflow-hidden bg-white/20 backdrop-blur-sm ring-4 ring-white/30 shadow-xl flex items-center justify-center">
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded-2xl">
                      <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                    </div>
                  )}
                  {avatarPreview || profile.avatarUrl ? (
                    <img
                      src={avatarPreview || profile.avatarUrl}
                      alt={profile.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-white text-4xl font-bold">
                      {getInitial(profile.name)}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleAvatarClick}
                  disabled={isUploading}
                  aria-label={t.avatarMenu.changePhoto}
                  title={t.avatarMenu.changePhoto}
                  className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center text-indigo-600 hover:bg-indigo-50 transition-colors border border-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="text-center sm:text-left min-w-0">
                <h2 className="text-2xl font-bold text-white break-words">{profile.name}</h2>
                <p className="text-indigo-100 text-sm mt-1 break-words">{profile.email}</p>
                <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${
                  profile.role === 'ADMIN'
                    ? 'bg-amber-400/20 text-amber-100'
                    : 'bg-white/20 text-white'
                }`}>
                  {profile.role === 'ADMIN' ? t.roles.admin : t.roles.student}
                </span>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 sm:p-8">
            {/* Success Message */}
            {isSaved && (
              <div className="mb-6 flex items-center space-x-3 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
                <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check size={16} className="text-white" />
                </div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  {t.profile.saved}
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-6 flex items-center space-x-3 p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl">
                <div className="w-8 h-8 bg-rose-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertCircle size={16} className="text-white" />
                </div>
                <p className="text-sm font-medium text-rose-700 dark:text-rose-400">{error}</p>
              </div>
            )}

            <div className="space-y-6">
              {/* Display Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  {t.profile.displayName}
                </label>
                <div className="relative">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={profile.name}
                    onChange={handleInputChange}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 dark:focus:border-indigo-500 transition-all"
                    placeholder={t.profile.displayNamePlaceholder}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                  {t.profile.displayNameHint}
                </p>
              </div>

              {/* Email (Read-only) */}
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  {t.profile.email}
                </label>
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={profile.email}
                    readOnly
                    className="w-full pl-12 pr-4 py-3 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                  {t.profile.emailHint}
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {t.profile.saveHint}
              </p>
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-lg shadow-indigo-500/25 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>{t.profile.saving}</span>
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    <span>{t.profile.saveChanges}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
