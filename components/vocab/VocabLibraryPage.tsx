import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import UserNavbar from '../user/UserNavbar';
import { getPublishedLibraries } from '../../services/vocabLibraryService';
import { VocabLibrary } from '../../types';
import { Library as LibraryIcon } from 'lucide-react';

// Content-only shelf — no progress/stats widgets here. There is nothing to
// source them from until Phase 3+ (UserWordProgress doesn't exist yet), and
// the architecture explicitly rejects showing fabricated numbers.
const VocabLibraryPage: React.FC = () => {
  const [libraries, setLibraries] = useState<VocabLibrary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPublishedLibraries()
      .then((res) => setLibraries(res.data))
      .catch((err) => setError(err.message || 'Failed to load vocabulary libraries'))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <UserNavbar />

      <main className="flex-grow py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-12">
            <h2 className="text-[22px] font-black text-slate-900 uppercase tracking-tight">
              Thư viện từ vựng
            </h2>
            <div className="h-1 w-12 bg-indigo-500 mt-2.5 rounded-full"></div>
          </div>

          {isLoading && (
            <p className="text-sm font-medium text-slate-400">Đang tải...</p>
          )}

          {error && (
            <p className="text-sm font-medium text-red-500 mb-6">{error}</p>
          )}

          {!isLoading && !error && libraries.length === 0 && (
            <p className="text-sm font-medium text-slate-400">
              Chưa có thư viện từ vựng nào được xuất bản.
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {libraries.map((library) => (
              <Link
                key={library.id}
                to={`/vocab/libraries/${library.id}`}
                className="bg-white rounded-[24px] shadow-lg p-8 flex flex-col items-center text-center h-full group transition-all duration-300 hover:border-indigo-100 border border-transparent"
              >
                <div className="w-20 h-20 rounded-2xl border-4 border-slate-50 group-hover:border-indigo-50 overflow-hidden bg-indigo-50 flex items-center justify-center text-indigo-500 mb-6 transition-all duration-300">
                  {library.thumbnail ? (
                    <img src={library.thumbnail} alt={library.name} className="w-full h-full object-cover" />
                  ) : (
                    <LibraryIcon size={32} />
                  )}
                </div>
                <h3 className="text-[18px] font-extrabold text-slate-900 mb-3 leading-tight group-hover:text-indigo-500 transition-colors">
                  {library.name}
                </h3>
                <p className="text-slate-500 text-[14px] leading-relaxed font-medium">
                  {library.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default VocabLibraryPage;
