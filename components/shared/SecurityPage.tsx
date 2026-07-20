import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Key, Check, AlertCircle, Shield, Eye, EyeOff } from 'lucide-react';
import { authService } from '../../services/authService';
import { changePassword } from '../../services/userService';
import { useTranslation } from '../../i18n/useTranslation';

// Serves both roles (the back link is role-aware), so it deliberately keeps
// its own standalone header rather than adopting the student sidebar shell.
const SecurityPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = authService.getUser();

  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  // Redirect if not authenticated
  useEffect(() => {
    if (!authService.isAuthenticated()) {
      navigate('/login');
    }
  }, [navigate]);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Map field names to state keys (current-pwd -> current for anti-autofill)
    const fieldName = name === 'current-pwd' ? 'current' : name;
    setPasswords(prev => ({ ...prev, [fieldName]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!passwords.current || !passwords.new || !passwords.confirm) {
      setError(t.security.fillAllFields);
      return;
    }

    if (passwords.new.length < 6) {
      setError(t.security.minLength);
      return;
    }

    if (passwords.new !== passwords.confirm) {
      setError(t.security.mismatch);
      return;
    }

    if (passwords.current === passwords.new) {
      setError(t.security.mustDiffer);
      return;
    }

    setIsLoading(true);

    try {
      await changePassword(passwords.current, passwords.new);

      setPasswords({ current: '', new: '', confirm: '' });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      console.error('Password change error:', err);
      setError(err.message || t.common.loadFailed);
    } finally {
      setIsLoading(false);
    }
  };

  const getBackLink = () => {
    return user?.role === 'ADMIN' ? '/admin' : '/home';
  };

  const inputClass =
    'w-full pl-12 pr-12 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 dark:focus:border-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed';

  const eyeButtonClass =
    'absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors';

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
                <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">{t.security.title}</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{t.security.subtitle}</p>
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
        {/* Security Overview */}
        <div className="mb-8 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-2xl p-6 sm:p-8 text-white shadow-lg dark:shadow-none">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center ring-4 ring-white/30 flex-shrink-0">
              <Shield size={32} className="text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold">{t.security.heroTitle}</h2>
              <p className="text-indigo-100 text-sm mt-1">
                {t.security.heroSubtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Change Password Section */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="px-6 sm:px-8 py-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-800/60 dark:to-transparent">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Key size={20} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{t.security.changePassword}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.security.changePasswordHint}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 sm:p-8">
            {/* Success Message */}
            {isSaved && (
              <div className="mb-6 flex items-center space-x-3 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
                <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check size={16} className="text-white" />
                </div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  {t.security.updated}
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

            <div className="space-y-5">
              {/* Hidden fields to trick browser autofill */}
              <input type="text" name="fake-username" style={{ display: 'none' }} tabIndex={-1} autoComplete="username" />
              <input type="password" name="fake-password" style={{ display: 'none' }} tabIndex={-1} autoComplete="current-password" />

              {/* Current Password */}
              <div>
                <label htmlFor="current-pwd" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  {t.security.currentPassword}
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type={showPasswords.current ? "text" : "password"}
                    id="current-pwd"
                    name="current-pwd"
                    value={passwords.current}
                    onChange={handlePasswordChange}
                    onFocus={(e) => e.target.removeAttribute('readonly')}
                    disabled={isLoading}
                    required
                    readOnly
                    autoComplete="off"
                    data-form-type="other"
                    className={inputClass}
                    placeholder={t.security.currentPlaceholder}
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('current')}
                    aria-label={showPasswords.current ? t.security.hidePassword : t.security.showPassword}
                    className={eyeButtonClass}
                  >
                    {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label htmlFor="new" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  {t.security.newPassword}
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type={showPasswords.new ? "text" : "password"}
                    id="new"
                    name="new"
                    value={passwords.new}
                    onChange={handlePasswordChange}
                    disabled={isLoading}
                    autoComplete="new-password"
                    className={inputClass}
                    placeholder={t.security.newPlaceholder}
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('new')}
                    aria-label={showPasswords.new ? t.security.hidePassword : t.security.showPassword}
                    className={eyeButtonClass}
                  >
                    {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirm" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  {t.security.confirmPassword}
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type={showPasswords.confirm ? "text" : "password"}
                    id="confirm"
                    name="confirm"
                    value={passwords.confirm}
                    onChange={handlePasswordChange}
                    disabled={isLoading}
                    autoComplete="new-password"
                    className={inputClass}
                    placeholder={t.security.confirmPlaceholder}
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('confirm')}
                    aria-label={showPasswords.confirm ? t.security.hidePassword : t.security.showPassword}
                    className={eyeButtonClass}
                  >
                    {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {passwords.confirm && passwords.new !== passwords.confirm && (
                  <p className="mt-1.5 text-xs text-rose-500 dark:text-rose-400">{t.security.mismatch}</p>
                )}
              </div>
            </div>

            {/* Password Requirements */}
            <div className="mt-6 p-4 bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/20 rounded-xl">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">{t.security.requirementsTitle}</h4>
              <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                <li className="flex items-center space-x-2">
                  <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
                  <span>{t.security.requirementMinLength}</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
                  <span>{t.security.requirementMix}</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
                  <span>{t.security.requirementNotSimple}</span>
                </li>
              </ul>
            </div>

            {/* Submit Button */}
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-end gap-4">
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-lg shadow-indigo-500/25 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>{t.security.updating}</span>
                  </>
                ) : (
                  <>
                    <Key size={18} />
                    <span>{t.security.updatePassword}</span>
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

export default SecurityPage;
