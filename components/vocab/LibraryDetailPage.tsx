import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import StudentLayout from '../user/StudentLayout';
import { getPublishedLibrary } from '../../services/vocabLibraryService';
import { getPublishedDecksByLibrary } from '../../services/vocabDeckService';
import { handleAuthError } from '../../services/apiError';
import { VocabLibrary, VocabDeck } from '../../types';
import { ArrowLeft, Layers } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

const LibraryDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

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
      .catch((err) => setError(handleAuthError(err, navigate) || t.common.loadFailed))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <StudentLayout>
      <div className="max-w-7xl mx-auto">
        <Link
          to="/vocab"
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-400 hover:text-indigo-500 dark:text-slate-500 dark:hover:text-indigo-400 transition-colors mb-8 min-h-[44px]"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          <span>{t.vocab.backToLibraries}</span>
        </Link>

        {isLoading && (
          <p className="text-sm font-medium text-slate-400 dark:text-slate-500">{t.common.loading}</p>
        )}

        {error && (
          <p className="text-sm font-medium text-rose-500">{error}</p>
        )}

        {!isLoading && !error && library && (
          <>
            <div className="mb-10">
              <h2 className="text-[22px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                {library.name}
              </h2>
              <div className="h-1 w-12 bg-indigo-500 mt-2.5 mb-6 rounded-full"></div>
              <p className="text-slate-500 dark:text-slate-400 text-[15px] font-medium max-w-2xl">{library.description}</p>
            </div>

            {decks.length === 0 && (
              <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
                {t.vocab.noDecks}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {decks.map((deck) => (
                // Phase 2: decks now have real word content, so tiles link
                // into DeckDetailPage instead of being non-navigating info
                // cards (the Phase 1 placeholder is gone).
                <Link
                  key={deck.id}
                  to={`/vocab/decks/${deck.id}`}
                  state={{ libraryId: library.id }}
                  className="bg-white dark:bg-slate-900 rounded-[24px] shadow-lg dark:shadow-none p-8 flex flex-col items-center text-center h-full group transition-all duration-300 hover:border-indigo-100 dark:hover:border-indigo-500/40 border border-transparent dark:border-slate-800"
                >
                  <div className="w-16 h-16 rounded-2xl border-4 border-slate-50 dark:border-slate-800 group-hover:border-indigo-50 dark:group-hover:border-indigo-500/20 overflow-hidden bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-6 transition-all duration-300">
                    {deck.thumbnail ? (
                      <img src={deck.thumbnail} alt={deck.name} className="w-full h-full object-cover" />
                    ) : (
                      <Layers size={26} aria-hidden="true" />
                    )}
                  </div>
                  <h3 className="text-[16px] font-extrabold text-slate-900 dark:text-slate-100 mb-2 leading-tight group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                    {deck.name}
                  </h3>
                  {deck.cefrLevel && (
                    <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded-md uppercase mb-3">
                      {deck.cefrLevel}
                    </span>
                  )}
                  {deck.description && (
                    <p className="text-slate-500 dark:text-slate-400 text-[13px] leading-relaxed font-medium mb-4">
                      {deck.description}
                    </p>
                  )}
                  <span className="mt-auto text-[11px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-wide">
                    {deck._count.deckWords} {t.vocab.wordsUnit}
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </StudentLayout>
  );
};

export default LibraryDetailPage;
