import React, { useEffect, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import UserNavbar from '../user/UserNavbar';
import { getPublishedDeck, getPublishedDeckWords } from '../../services/vocabDeckService';
import { VocabDeck, VocabWordListItem } from '../../types';
import { ArrowLeft, Layers, Volume2 } from 'lucide-react';

const DeckDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const state = location.state as { libraryId?: string } | null;

  const [deck, setDeck] = useState<VocabDeck | null>(null);
  const [words, setWords] = useState<VocabWordListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    Promise.all([getPublishedDeck(id), getPublishedDeckWords(id)])
      .then(([deckRes, wordsRes]) => {
        setDeck(deckRes);
        setWords(wordsRes.data);
      })
      .catch((err) => setError(err.message || 'Failed to load deck'))
      .finally(() => setIsLoading(false));
  }, [id]);

  const playAudio = (url: string) => {
    new Audio(url).play().catch(() => {
      // Ignore playback errors (e.g. browser autoplay restrictions).
    });
  };

  const backHref = deck ? `/vocab/libraries/${deck.libraryId}` : state?.libraryId ? `/vocab/libraries/${state.libraryId}` : '/vocab';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <UserNavbar />

      <main className="flex-grow py-16">
        <div className="max-w-5xl mx-auto px-6">
          <Link
            to={backHref}
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

          {!isLoading && !error && deck && (
            <>
              <div className="mb-12">
                <div className="flex items-center space-x-3 mb-3">
                  <h2 className="text-[22px] font-black text-slate-900 uppercase tracking-tight">{deck.name}</h2>
                  {deck.cefrLevel && (
                    <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md uppercase">
                      {deck.cefrLevel}
                    </span>
                  )}
                </div>
                <div className="h-1 w-12 bg-indigo-500 mb-6 rounded-full"></div>
                {deck.description && (
                  <p className="text-slate-500 text-[15px] font-medium max-w-2xl mb-2">{deck.description}</p>
                )}
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                  {deck._count.deckWords} từ vựng
                </p>
              </div>

              {/* Genuinely reachable, not a defensive placeholder: decks
                  grandfathered as published-empty under Phase 1's looser
                  publish rule, plus the accepted publish/detach race (see
                  the approved Phase 2 plan §4), can both land here. */}
              {words.length === 0 && (
                <div className="bg-white rounded-[24px] shadow-lg p-12 text-center">
                  <Layers size={32} className="mx-auto text-slate-200 mb-4" />
                  <p className="text-sm font-medium text-slate-400">Bộ từ này chưa có từ vựng.</p>
                </div>
              )}

              <div className="space-y-3">
                {words.map((word) => (
                  <div
                    key={word.id}
                    className="bg-white rounded-2xl shadow-sm hover:shadow-md p-5 flex items-center justify-between transition-all duration-200"
                  >
                    <Link to={`/vocab/words/${word.id}`} state={{ deckId: id, deckName: deck.name }} className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-[16px] font-extrabold text-slate-900">{word.text}</h3>
                        {word.ipa && <span className="text-[13px] text-slate-400">{word.ipa}</span>}
                        {word.cefrLevel && (
                          <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md uppercase">
                            {word.cefrLevel}
                          </span>
                        )}
                      </div>
                      {word.meanings[0] && (
                        <p className="text-slate-500 text-[14px] font-medium mt-1 truncate">
                          {word.meanings[0].meaning}
                        </p>
                      )}
                    </Link>
                    {word.audioUrl && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          playAudio(word.audioUrl!);
                        }}
                        className="ml-4 p-2.5 text-indigo-500 hover:bg-indigo-50 rounded-xl transition-colors flex-shrink-0"
                        title="Nghe phát âm"
                      >
                        <Volume2 size={18} />
                      </button>
                    )}
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

export default DeckDetailPage;
