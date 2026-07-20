import React, { useEffect, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import StudentLayout from '../user/StudentLayout';
import { getWord } from '../../services/vocabWordService';
import { VocabWordDetail } from '../../types';
import { ArrowLeft, Volume2 } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

const ChipGroup: React.FC<{ label: string; items: string[] }> = ({ label, items }) => {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="text-[13px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg"
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
  const { t } = useTranslation();

  const [word, setWord] = useState<VocabWordDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    getWord(id)
      .then(setWord)
      .catch((err) => setError(err.message || t.common.loadFailed))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const playAudio = () => {
    if (word?.audioUrl) {
      new Audio(word.audioUrl).play().catch(() => {
        // Ignore playback errors (e.g. browser autoplay restrictions).
      });
    }
  };

  const backHref = state?.deckId ? `/vocab/decks/${state.deckId}` : '/vocab';
  const backLabel = state?.deckName ? `${t.vocab.backTo} ${state.deckName}` : t.vocab.backToVocab;

  return (
    <StudentLayout>
      <div className="max-w-3xl mx-auto">
        <Link
          to={backHref}
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-400 hover:text-indigo-500 dark:text-slate-500 dark:hover:text-indigo-400 transition-colors mb-8 min-h-[44px]"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          <span>{backLabel}</span>
        </Link>

        {isLoading && (
          <p className="text-sm font-medium text-slate-400 dark:text-slate-500">{t.common.loading}</p>
        )}

        {error && (
          <p className="text-sm font-medium text-rose-500">{error}</p>
        )}

        {!isLoading && !error && word && (
          <div className="bg-white dark:bg-slate-900 rounded-[24px] shadow-lg dark:shadow-none dark:border dark:border-slate-800 p-6 sm:p-10">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-2">
                  <h1 className="text-[28px] sm:text-[32px] font-black text-slate-900 dark:text-slate-100 break-words">{word.text}</h1>
                  {word.cefrLevel && (
                    <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1 rounded-md uppercase">
                      {word.cefrLevel}
                    </span>
                  )}
                </div>
                {word.ipa && (
                  <p className="text-slate-400 dark:text-slate-500 text-[16px] font-medium">{word.ipa}</p>
                )}
              </div>
              {word.imageUrl && (
                <img
                  src={word.imageUrl}
                  alt={word.text}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover flex-shrink-0"
                />
              )}
            </div>

            {word.audioUrl && (
              <button
                onClick={playAudio}
                className="flex items-center space-x-2 px-4 py-2.5 min-h-[44px] bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl text-sm font-bold hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors mb-8 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <Volume2 size={16} aria-hidden="true" />
                <span>{t.vocab.listen}</span>
              </button>
            )}

            <div className="space-y-6">
              <div>
                <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">
                  {t.vocab.meanings}
                </p>
                <div className="space-y-3">
                  {word.meanings.map((m) => (
                    <div key={m.id} className="flex items-start space-x-3">
                      {m.partOfSpeech && (
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded uppercase mt-0.5 flex-shrink-0">
                          {m.partOfSpeech}
                        </span>
                      )}
                      <p className="text-slate-700 dark:text-slate-200 text-[15px] font-medium">{m.meaning}</p>
                    </div>
                  ))}
                </div>
              </div>

              {word.examples.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">
                    {t.vocab.examples}
                  </p>
                  <div className="space-y-3">
                    {word.examples.map((ex) => (
                      <div key={ex.id} className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4">
                        <p className="text-slate-700 dark:text-slate-200 text-[14px] font-medium italic">"{ex.sentence}"</p>
                        {ex.translation && (
                          <p className="text-slate-400 dark:text-slate-500 text-[13px] font-medium mt-1">{ex.translation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <ChipGroup label={t.vocab.synonyms} items={word.synonyms} />
              <ChipGroup label={t.vocab.antonyms} items={word.antonyms} />
              <ChipGroup label={t.vocab.collocations} items={word.collocations} />
              <ChipGroup label={t.vocab.wordFamily} items={word.wordFamily} />
            </div>
          </div>
        )}
      </div>
    </StudentLayout>
  );
};

export default WordDetailPage;
