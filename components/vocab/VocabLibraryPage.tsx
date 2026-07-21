import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StudentLayout from '../user/StudentLayout';
import { getPublishedLibraries } from '../../services/vocabLibraryService';
import { handleAuthError } from '../../services/apiError';
import { VocabLibrary } from '../../types';
import { Library as LibraryIcon } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

// Content-only shelf — no progress/stats widgets here. There is nothing to
// source them from until Phase 3+ (UserWordProgress doesn't exist yet), and
// the architecture explicitly rejects showing fabricated numbers.
const VocabLibraryPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [libraries, setLibraries] = useState<VocabLibrary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPublishedLibraries()
      .then((res) => setLibraries(res.data))
      .catch((err) => setError(handleAuthError(err, navigate) || t.common.loadFailed))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <StudentLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-10">
          <h2 className="text-[22px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
            {t.vocab.title}
          </h2>
          <div className="h-1 w-12 bg-indigo-500 mt-2.5 rounded-full"></div>
        </div>

        {isLoading && (
          <p className="text-sm font-medium text-slate-400 dark:text-slate-500">{t.common.loading}</p>
        )}

        {error && (
          <p className="text-sm font-medium text-rose-500 mb-6">{error}</p>
        )}

        {!isLoading && !error && libraries.length === 0 && (
          <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
            {t.vocab.noLibraries}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {libraries.map((library) => (
            <Link
              key={library.id}
              to={`/vocab/libraries/${library.id}`}
              className="bg-white dark:bg-slate-900 rounded-[24px] shadow-lg dark:shadow-none p-8 flex flex-col items-center text-center h-full group transition-all duration-300 hover:border-indigo-100 dark:hover:border-indigo-500/40 border border-transparent dark:border-slate-800"
            >
              <div className="w-20 h-20 rounded-2xl border-4 border-slate-50 dark:border-slate-800 group-hover:border-indigo-50 dark:group-hover:border-indigo-500/20 overflow-hidden bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 dark:text-indigo-400 mb-6 transition-all duration-300">
                {library.thumbnail ? (
                  <img src={library.thumbnail} alt={library.name} className="w-full h-full object-cover" />
                ) : (
                  <LibraryIcon size={32} aria-hidden="true" />
                )}
              </div>
              <h3 className="text-[18px] font-extrabold text-slate-900 dark:text-slate-100 mb-3 leading-tight group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                {library.name}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-[14px] leading-relaxed font-medium">
                {library.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </StudentLayout>
  );
};

export default VocabLibraryPage;
