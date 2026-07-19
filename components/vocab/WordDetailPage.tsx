import React, { useEffect, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import UserNavbar from '../user/UserNavbar';
import { getWord } from '../../services/vocabWordService';
import { VocabWordDetail } from '../../types';
import { ArrowLeft, Volume2 } from 'lucide-react';

const ChipGroup: React.FC<{ label: string; items: string[] }> = ({ label, items }) => {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="text-[13px] font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
};

const WordDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const state = location.state as { deckId?: string; deckName?: string } | null;

  const [word, setWord] = useState<VocabWordDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    getWord(id)
      .then(setWord)
      .catch((err) => setError(err.message || 'Failed to load word'))
      .finally(() => setIsLoading(false));
  }, [id]);

  const playAudio = () => {
    if (word?.audioUrl) {
      new Audio(word.audioUrl).play().catch(() => {
        // Ignore playback errors (e.g. browser autoplay restrictions).
      });
    }
  };

  const backHref = state?.deckId ? `/vocab/decks/${state.deckId}` : '/vocab';
  const backLabel = state?.deckName ? `Quay lại ${state.deckName}` : 'Quay lại thư viện từ vựng';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <UserNavbar />

      <main className="flex-grow py-16">
        <div className="max-w-3xl mx-auto px-6">
          <Link
            to={backHref}
            className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-400 hover:text-indigo-500 transition-colors mb-8"
          >
            <ArrowLeft size={14} />
            <span>{backLabel}</span>
          </Link>

          {isLoading && (
            <p className="text-sm font-medium text-slate-400">Đang tải...</p>
          )}

          {error && (
            <p className="text-sm font-medium text-red-500">{error}</p>
          )}

          {!isLoading && !error && word && (
            <div className="bg-white rounded-[24px] shadow-lg p-10">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <h1 className="text-[32px] font-black text-slate-900">{word.text}</h1>
                    {word.cefrLevel && (
                      <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md uppercase">
                        {word.cefrLevel}
                      </span>
                    )}
                  </div>
                  {word.ipa && <p className="text-slate-400 text-[16px] font-medium">{word.ipa}</p>}
                </div>
                {word.imageUrl && (
                  <img
                    src={word.imageUrl}
                    alt={word.text}
                    className="w-24 h-24 rounded-2xl object-cover flex-shrink-0"
                  />
                )}
              </div>

              {word.audioUrl && (
                <button
                  onClick={playAudio}
                  className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-colors mb-8"
                >
                  <Volume2 size={16} />
                  <span>Nghe phát âm</span>
                </button>
              )}

              <div className="space-y-6">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-3">Nghĩa</p>
                  <div className="space-y-3">
                    {word.meanings.map((m) => (
                      <div key={m.id} className="flex items-start space-x-3">
                        {m.partOfSpeech && (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase mt-0.5 flex-shrink-0">
                            {m.partOfSpeech}
                          </span>
                        )}
                        <p className="text-slate-700 text-[15px] font-medium">{m.meaning}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {word.examples.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-3">Ví dụ</p>
                    <div className="space-y-3">
                      {word.examples.map((ex) => (
                        <div key={ex.id} className="bg-slate-50 rounded-xl p-4">
                          <p className="text-slate-700 text-[14px] font-medium italic">"{ex.sentence}"</p>
                          {ex.translation && (
                            <p className="text-slate-400 text-[13px] font-medium mt-1">{ex.translation}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <ChipGroup label="Từ đồng nghĩa" items={word.synonyms} />
                <ChipGroup label="Từ trái nghĩa" items={word.antonyms} />
                <ChipGroup label="Collocations" items={word.collocations} />
                <ChipGroup label="Họ từ" items={word.wordFamily} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default WordDetailPage;
