import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import UserNavbar from '../user/UserNavbar';
import { getPublishedLibrary } from '../../services/vocabLibraryService';
import { getPublishedDecksByLibrary } from '../../services/vocabDeckService';
import { VocabLibrary, VocabDeck } from '../../types';
import { ArrowLeft, Layers } from 'lucide-react';

const LibraryDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [library, setLibrary] = useState<VocabLibrary | null>(null);
  const [decks, setDecks] = useState<VocabDeck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    Promise.all([getPublishedLibrary(id), getPublishedDecksByLibrary(id)])
      .then(([libraryRes, decksRes]) => {
        setLibrary(libraryRes);
        setDecks(decksRes.data);
      })
      .catch((err) => setError(err.message || 'Failed to load vocabulary library'))
      .finally(() => setIsLoading(false));
  }, [id]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <UserNavbar />

      <main className="flex-grow py-16">
        <div className="max-w-7xl mx-auto px-6">
          <Link
            to="/vocab"
            className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-400 hover:text-indigo-500 transition-colors mb-8"
          >
            <ArrowLeft size={14} />
            <span>Quay lại thư viện</span>
          </Link>

          {isLoading && (
            <p className="text-sm font-medium text-slate-400">Đang tải...</p>
          )}

          {error && (
            <p className="text-sm font-medium text-red-500">{error}</p>
          )}

          {!isLoading && !error && library && (
            <>
              <div className="mb-12">
                <h2 className="text-[22px] font-black text-slate-900 uppercase tracking-tight">
                  {library.name}
                </h2>
                <div className="h-1 w-12 bg-indigo-500 mt-2.5 mb-6 rounded-full"></div>
                <p className="text-slate-500 text-[15px] font-medium max-w-2xl">{library.description}</p>
              </div>

              {decks.length === 0 && (
                <p className="text-sm font-medium text-slate-400">
                  Chưa có bộ từ nào trong thư viện này.
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {decks.map((deck) => (
                  // Deck cards are non-navigating info tiles this phase — there
                  // are no words yet (DeckWord doesn't exist until Phase 2), so
                  // a detail page would render nothing of value. Same "don't
                  // present something as actionable if it isn't" principle the
                  // admin sidebar's "Sắp có" badges already use.
                  <div
                    key={deck.id}
                    className="bg-white rounded-[24px] shadow-lg p-8 flex flex-col items-center text-center h-full border border-transparent"
                  >
                    <div className="w-16 h-16 rounded-2xl border-4 border-slate-50 overflow-hidden bg-indigo-50 flex items-center justify-center text-indigo-400 mb-6">
                      {deck.thumbnail ? (
                        <img src={deck.thumbnail} alt={deck.name} className="w-full h-full object-cover" />
                      ) : (
                        <Layers size={26} />
                      )}
                    </div>
                    <h3 className="text-[16px] font-extrabold text-slate-900 mb-2 leading-tight">
                      {deck.name}
                    </h3>
                    {deck.cefrLevel && (
                      <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md uppercase mb-3">
                        {deck.cefrLevel}
                      </span>
                    )}
                    {deck.description && (
                      <p className="text-slate-500 text-[13px] leading-relaxed font-medium mb-4">
                        {deck.description}
                      </p>
                    )}
                    <span className="mt-auto text-[11px] font-bold text-slate-300 uppercase tracking-wide">
                      Nội dung đang được xây dựng
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default LibraryDetailPage;
