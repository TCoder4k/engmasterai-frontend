import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import StudentLayout from '../user/StudentLayout';
import { getPublishedDeck, getPublishedDeckWords } from '../../services/vocabDeckService';
import { getDeckProgress, DeckProgress } from '../../services/learningService';
import { handleAuthError } from '../../services/apiError';
import { VocabDeck, VocabWordListItem } from '../../types';
import { ArrowLeft, Layers, Volume2 } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

// /vocab/decks/:id — dictionary-mode browsing for a single deck.
//
// Sprint 04D: gains a real learning summary and a real practice action.
// A genuinely empty deck deliberately gets NEITHER — no percentages (they
// would all be a meaningless 0%) and no practice link (it would open a
// broken, wordless session).
const DeckDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const state = location.state as { libraryId?: string } | null;
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [deck, setDeck] = useState<VocabDeck | null>(null);
  const [words, setWords] = useState<VocabWordListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<DeckProgress | null>(null);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    Promise.all([getPublishedDeck(id), getPublishedDeckWords(id)])
      .then(([deckRes, wordsRes]) => {
        setDeck(deckRes);
        setWords(wordsRes.data);
      })
      .catch((err) => setError(handleAuthError(err, navigate) || t.common.loadFailed))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Supplementary — a progress failure leaves the deck browsable without a
  // summary rather than failing the whole page.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getDeckProgress(id)
      .then((res) => {
        if (!cancelled) setProgress(res);
      })
      .catch(() => {
        // Intentionally silent — see the comment above.
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Same rules as the deck rows on LibraryDetailPage: due words win, then
  // fully-mastered, then untouched, then partial.
  const practiceAction = (() => {
    if (!progress || progress.totalWords === 0) return null;
    if (progress.dueWords > 0) {
      return { label: t.vocab.reviewDueAction, to: `/practice/review?deckId=${id}` };
    }
    const flashcardHref = `/practice/vocab/${id}?mode=flashcard`;
    if (progress.masteredWords === progress.totalWords) return { label: t.vocab.practiceAgain, to: flashcardHref };
    if (progress.newWords === progress.totalWords) return { label: t.vocab.startPractice, to: flashcardHref };
    return { label: t.vocab.continuePractice, to: flashcardHref };
  })();

  const playAudio = (url: string) => {
    new Audio(url).play().catch(() => {
      // Ignore playback errors (e.g. browser autoplay restrictions).
    });
  };

  const backHref = deck
    ? `/vocab/libraries/${deck.libraryId}`
    : state?.libraryId
      ? `/vocab/libraries/${state.libraryId}`
      : '/vocab';

  return (
    <StudentLayout>
      <div className="max-w-5xl mx-auto">
        <Link
          to={backHref}
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-400 hover:text-indigo-500 dark:text-slate-500 dark:hover:text-indigo-400 transition-colors mb-8 min-h-[44px]"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          <span>{t.vocab.backToLibrary}</span>
        </Link>

        {isLoading && (
          <p className="text-sm font-medium text-slate-400 dark:text-slate-500">{t.common.loading}</p>
        )}

        {error && (
          <p className="text-sm font-medium text-rose-500">{error}</p>
        )}

        {!isLoading && !error && deck && (
          <>
            <div className="mb-10">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <h2 className="text-[22px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">{deck.name}</h2>
                {deck.cefrLevel && (
                  <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1 rounded-md uppercase">
                    {deck.cefrLevel}
                  </span>
                )}
              </div>
              <div className="h-1 w-12 bg-indigo-500 mb-6 rounded-full"></div>
              {deck.description && (
                <p className="text-slate-500 dark:text-slate-400 text-[15px] font-medium max-w-2xl mb-2">{deck.description}</p>
              )}
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                {deck._count.deckWords} {t.vocab.wordsUnit}
              </p>

              {/* Real learning summary + action. Rendered only when the deck
                  actually has words — an empty deck would otherwise show a
                  row of meaningless 0% figures and a link into a session
                  with nothing in it. */}
              {progress && progress.totalWords > 0 && (
                <div className="mt-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold">
                    <span className="text-indigo-600 dark:text-indigo-400">
                      {t.vocab.startedLabel}: {progress.startedPercent}%
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {t.vocab.masteredLabel}: {progress.masteredPercent}%
                    </span>
                    {progress.dueWords > 0 && (
                      <span className="text-amber-600 dark:text-amber-400">
                        {t.vocab.dueTodayLabel}: {progress.dueWords}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                    <span>
                      {t.vocab.newUnit}: {progress.newWords}
                    </span>
                    <span>
                      {t.vocab.learningUnit}: {progress.learningWords}
                    </span>
                    <span>
                      {t.vocab.reviewUnit}: {progress.reviewWords}
                    </span>
                  </div>

                  {practiceAction && (
                    <Link
                      to={practiceAction.to}
                      className="inline-flex px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl text-xs sm:text-sm font-bold hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                    >
                      {practiceAction.label}
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Genuinely reachable, not a defensive placeholder: decks
                grandfathered as published-empty under Phase 1's looser
                publish rule, plus the accepted publish/detach race (see
                the approved Phase 2 plan §4), can both land here. */}
            {words.length === 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-[24px] shadow-lg dark:shadow-none dark:border dark:border-slate-800 p-12 text-center">
                <Layers size={32} className="mx-auto text-slate-200 dark:text-slate-700 mb-4" aria-hidden="true" />
                <p className="text-sm font-medium text-slate-400 dark:text-slate-500">{t.vocab.deckNoWords}</p>
              </div>
            )}

            <div className="space-y-3">
              {words.map((word) => (
                <div
                  key={word.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm hover:shadow-md dark:shadow-none dark:border dark:border-slate-800 dark:hover:border-slate-700 p-4 sm:p-5 flex items-center justify-between transition-all duration-200"
                >
                  <Link to={`/vocab/words/${word.id}`} state={{ deckId: id, deckName: deck.name }} className="flex-1 min-w-0 py-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h3 className="text-[16px] font-extrabold text-slate-900 dark:text-slate-100">{word.text}</h3>
                      {word.ipa && <span className="text-[13px] text-slate-400 dark:text-slate-500">{word.ipa}</span>}
                      {word.cefrLevel && (
                        <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-md uppercase">
                          {word.cefrLevel}
                        </span>
                      )}
                    </div>
                    {word.meanings[0] && (
                      <p className="text-slate-500 dark:text-slate-400 text-[14px] font-medium mt-1 truncate">
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
                      aria-label={t.vocab.listen}
                      title={t.vocab.listen}
                      className="ml-3 w-11 h-11 flex items-center justify-center text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-colors flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                    >
                      <Volume2 size={18} aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </StudentLayout>
  );
};

export default DeckDetailPage;
