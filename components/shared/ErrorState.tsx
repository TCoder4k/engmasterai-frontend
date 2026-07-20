import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

// Student-friendly error surface (Student Learning Experience design,
// Principle #11) — callers must pass an already-plain-language message,
// never raw API/error text.
const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => {
  const { t } = useTranslation();
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[24px] shadow-lg dark:shadow-none dark:border dark:border-slate-800 p-12 text-center">
      <AlertCircle size={32} className="mx-auto text-rose-300 dark:text-rose-500/60 mb-4" aria-hidden="true" />
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-sm font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-lg px-3 py-1.5"
        >
          {t.common.tryAgain}
        </button>
      )}
    </div>
  );
};

export default ErrorState;
