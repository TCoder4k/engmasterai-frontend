import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../theme/ThemeProvider';
import { useTranslation } from '../../i18n/useTranslation';

// Sun/moon light-dark toggle. 40px on phones (the mobile header is the one
// place five controls must fit at 320px), 44px from md up.
const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();

  const label = theme === 'dark' ? t.header.switchToLight : t.header.switchToDark;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-200 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:text-indigo-400 dark:hover:border-slate-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
    >
      {theme === 'dark' ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
    </button>
  );
};

export default ThemeToggle;
