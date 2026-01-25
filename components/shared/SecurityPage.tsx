import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Key, Check, AlertCircle, Shield, Eye, EyeOff } from 'lucide-react';
import { authService } from '../../services/authService';
import { changePassword } from '../../services/userService';

const SecurityPage: React.FC = () => {
  const navigate = useNavigate();
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
      setError('Vui lòng điền đầy đủ thông tin');
      return;
    }

    if (passwords.new.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }

    if (passwords.new !== passwords.confirm) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    if (passwords.current === passwords.new) {
      setError('Mật khẩu mới phải khác mật khẩu hiện tại');
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
      setError(err.message || 'Không thể cập nhật mật khẩu. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const getBackLink = () => {
    return user?.role === 'ADMIN' ? '/admin' : '/home';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                to={getBackLink()}
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} />
              </Link>
              <div>
                <h1 className="text-lg font-bold text-slate-900">Bảo mật</h1>
                <p className="text-xs text-slate-500">Quản lý bảo mật tài khoản</p>
              </div>
            </div>
            <Link to={getBackLink()} className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">E</span>
              </div>
              <span className="text-lg font-bold text-slate-900 hidden sm:block">
                Engmaster<span className="text-indigo-500">AI</span>
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Security Overview */}
        <div className="mb-8 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-2xl p-8 text-white shadow-lg">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center ring-4 ring-white/30">
              <Shield size={32} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Bảo mật tài khoản</h2>
              <p className="text-indigo-100 text-sm mt-1">
                Đảm bảo an toàn cho tài khoản của bạn với mật khẩu mạnh
              </p>
            </div>
          </div>
        </div>

        {/* Change Password Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-transparent">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Key size={20} className="text-indigo-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Change Password</h3>
                <p className="text-xs text-slate-500 mt-0.5">Cập nhật mật khẩu đăng nhập</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-8">
            {/* Success Message */}
            {isSaved && (
              <div className="mb-6 flex items-center space-x-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                  <Check size={16} className="text-white" />
                </div>
                <p className="text-sm font-medium text-emerald-700">
                  Mật khẩu đã được cập nhật thành công!
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-6 flex items-center space-x-3 p-4 bg-rose-50 border border-rose-200 rounded-xl">
                <div className="w-8 h-8 bg-rose-500 rounded-full flex items-center justify-center">
                  <AlertCircle size={16} className="text-white" />
                </div>
                <p className="text-sm font-medium text-rose-700">{error}</p>
              </div>
            )}

            <div className="space-y-5">
              {/* Hidden fields to trick browser autofill */}
              <input type="text" name="fake-username" style={{ display: 'none' }} tabIndex={-1} autoComplete="username" />
              <input type="password" name="fake-password" style={{ display: 'none' }} tabIndex={-1} autoComplete="current-password" />
              
              {/* Current Password */}
              <div>
                <label htmlFor="current-pwd" className="block text-sm font-semibold text-slate-700 mb-2">
                  Current Password
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
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
                    className="w-full pl-12 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Nhập mật khẩu hiện tại"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('current')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label htmlFor="new" className="block text-sm font-semibold text-slate-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPasswords.new ? "text" : "password"}
                    id="new"
                    name="new"
                    value={passwords.new}
                    onChange={handlePasswordChange}
                    disabled={isLoading}
                    autoComplete="new-password"
                    className="w-full pl-12 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('new')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirm" className="block text-sm font-semibold text-slate-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPasswords.confirm ? "text" : "password"}
                    id="confirm"
                    name="confirm"
                    value={passwords.confirm}
                    onChange={handlePasswordChange}
                    disabled={isLoading}
                    autoComplete="new-password"
                    className="w-full pl-12 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Nhập lại mật khẩu mới"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('confirm')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {passwords.confirm && passwords.new !== passwords.confirm && (
                  <p className="mt-1.5 text-xs text-rose-500">Mật khẩu xác nhận không khớp</p>
                )}
              </div>
            </div>

            {/* Password Requirements */}
            <div className="mt-6 p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
              <h4 className="text-xs font-bold text-slate-700 mb-2">Yêu cầu mật khẩu:</h4>
              <ul className="space-y-1 text-xs text-slate-600">
                <li className="flex items-center space-x-2">
                  <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
                  <span>Tối thiểu 6 ký tự</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
                  <span>Nên sử dụng kết hợp chữ hoa, chữ thường và số</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
                  <span>Không sử dụng mật khẩu quá đơn giản</span>
                </li>
              </ul>
            </div>

            {/* Submit Button */}
            <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
             
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Đang cập nhật...</span>
                  </>
                ) : (
                  <>
                    <Key size={18} />
                    <span>Update Password</span>
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
