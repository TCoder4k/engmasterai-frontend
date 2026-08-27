import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Plus, Sparkles } from 'lucide-react';
import StudentLayout from '../user/StudentLayout';
import { useTranslation } from '../../i18n/useTranslation';
import { handleAuthError } from '../../services/apiError';
import {
  getAllPersonalVocabWords,
  getPersonalVocabStats,
  PersonalVocabStats,
  PersonalVocabWord,
} from '../../services/vocabPersonalService';
import { SessionResult } from '../practice/types';
import SessionSummary from '../practice/SessionSummary';
import PersonalWordListTab from './personal/PersonalWordListTab';
import PersonalFlashcardSession from './personal/PersonalFlashcardSession';
import PersonalDictationSession from './personal/PersonalDictationSession';
import PersonalVocabStatsChart from './personal/PersonalVocabStatsChart';
import AddPersonalWordModal from './personal/AddPersonalWordModal';
import ImportPersonalWordsModal from './personal/ImportPersonalWordsModal';

type MainTab = 'list' | 'flashcard' | 'dictation';
// Set only while a session is actually running — the sidebar's "Bắt đầu ôn
// tập" launches a due-only flashcard session that isn't one of the three
// visible tabs, so it's tracked separately rather than smuggled into MainTab.
type SessionMode = { kind: 'flashcard' | 'dictation'; words: PersonalVocabWord[] } | null;

const StatCard: React.FC<{ label: string; value: number; accent: string }> = ({ label, value, accent }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4">
    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
    <p className={`text-2xl font-black mt-1 ${accent}`}>{value}</p>
  </div>
);

// "Từ vựng của tôi" (My Vocabulary) — route /vocab/my-words. A student's own
// saved-word list, independent of the admin-curated Library/Deck shelf (see
// VocabLibraryPage). Header/stat-cards/3-tab-bar/sidebar structure follows
// the approved plan's mockup; every number shown is real (GET
// /vocab-personal/stats), including the sidebar's suggestion chips, which
// are driven by dueTodayCount/struggledCount rather than invented copy.
const MyVocabularyPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<MainTab>('list');
  const [stats, setStats] = useState<PersonalVocabStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [listRefreshToken, setListRefreshToken] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [session, setSession] = useState<SessionMode>(null);
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);
  const [isLoadingSessionWords, setIsLoadingSessionWords] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const refreshStats = () => {
    getPersonalVocabStats()
      .then(setStats)
      .catch((err) => setStatsError(handleAuthError(err, navigate) || t.myVocab.loadFailed));
  };

  useEffect(() => {
    refreshStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listRefreshToken]);

  const bumpRefresh = () => setListRefreshToken((v) => v + 1);

  const startSession = async (kind: 'flashcard' | 'dictation', dueOnly = false) => {
    setSessionError(null);
    setSessionResult(null);
    setIsLoadingSessionWords(true);
    try {
      const words = await getAllPersonalVocabWords(dueOnly ? { dueOnly: true } : {});
      setSession({ kind, words });
    } catch (err) {
      setSessionError(handleAuthError(err, navigate) || t.myVocab.loadFailed);
    } finally {
      setIsLoadingSessionWords(false);
    }
  };

  const handleSelectTab = (tab: MainTab) => {
    setActiveTab(tab);
    setSession(null);
    setSessionResult(null);
    if (tab === 'flashcard') void startSession('flashcard');
    if (tab === 'dictation') void startSession('dictation');
  };

  const handleWordReviewed = () => bumpRefresh();

  const stat = (key: keyof PersonalVocabStats): number => (stats ? (stats[key] as number) : 0);

  return (
    <StudentLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h2 className="text-[22px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
              {t.myVocab.pageTitle}
            </h2>
            <div className="h-1 w-12 bg-blue-500 mt-2.5 rounded-full" />
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 max-w-xl">{t.myVocab.pageSubtitle}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <Upload size={15} aria-hidden="true" />
              {t.myVocab.importWords}
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:opacity-90 transition-opacity"
            >
              <Plus size={15} aria-hidden="true" />
              {t.myVocab.addWord}
            </button>
          </div>
        </div>

        {statsError && <p className="text-sm font-medium text-rose-500">{statsError}</p>}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label={t.myVocab.statTotal} value={stat('total')} accent="text-slate-900 dark:text-slate-100" />
          <StatCard
            label={t.myVocab.statMastered}
            value={stat('mastered')}
            accent="text-emerald-600 dark:text-emerald-400"
          />
          <StatCard label={t.myVocab.statLearning} value={stat('learning')} accent="text-amber-600 dark:text-amber-400" />
          <StatCard label={t.myVocab.statNew} value={stat('new')} accent="text-slate-500 dark:text-slate-400" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-4">
            <div role="tablist" className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit">
              {(['list', 'flashcard', 'dictation'] as MainTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab}
                  onClick={() => handleSelectTab(tab)}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                    activeTab === tab
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tab === 'list' ? t.myVocab.tabList : tab === 'flashcard' ? t.myVocab.tabFlashcard : t.myVocab.tabDictation}
                </button>
              ))}
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-4 sm:p-6">
              {activeTab === 'list' && <PersonalWordListTab refreshToken={listRefreshToken} />}

              {activeTab !== 'list' && (
                <PracticeSessionPanel
                  isLoading={isLoadingSessionWords}
                  error={sessionError}
                  session={session}
                  result={sessionResult}
                  onWordReviewed={handleWordReviewed}
                  onComplete={setSessionResult}
                  onRestart={() => {
                    setSessionResult(null);
                    void startSession(activeTab === 'dictation' ? 'dictation' : 'flashcard');
                  }}
                  onExit={() => handleSelectTab('list')}
                />
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 space-y-3">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{t.myVocab.reviewTodayTitle}</p>
              {stat('dueTodayCount') > 0 ? (
                <>
                  <p className="text-3xl font-black text-blue-600 dark:text-blue-400">
                    {stat('dueTodayCount')}{' '}
                    <span className="text-sm font-bold text-slate-400 dark:text-slate-500">
                      {t.myVocab.reviewTodayCount}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('flashcard');
                      setSessionResult(null);
                      void startSession('flashcard', true);
                    }}
                    className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:opacity-90 transition-opacity"
                  >
                    {t.myVocab.startReview}
                  </button>
                </>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500">{t.myVocab.reviewTodayEmpty}</p>
              )}
            </div>

            {stats && stats.reviewsLast7Days.some((d) => d.count > 0) && (
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5">
                <PersonalVocabStatsChart data={stats.reviewsLast7Days} />
              </div>
            )}

            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 space-y-2.5">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Sparkles size={15} className="text-amber-400" aria-hidden="true" />
                {t.myVocab.suggestionsTitle}
              </p>
              {stat('dueTodayCount') > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400 bg-blue-50 dark:bg-blue-500/10 rounded-xl p-2.5">
                  {t.myVocab.suggestionDue}
                </p>
              )}
              {stat('struggledCount') > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400 bg-amber-50 dark:bg-amber-500/10 rounded-xl p-2.5">
                  {t.myVocab.suggestionStruggled}
                </p>
              )}
              {stat('dueTodayCount') === 0 && stat('struggledCount') === 0 && stats && (
                <p className="text-xs text-slate-500 dark:text-slate-400 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-2.5">
                  {t.myVocab.suggestionAllGood}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {showAddModal && (
        <AddPersonalWordModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            bumpRefresh();
          }}
        />
      )}
      {showImportModal && (
        <ImportPersonalWordsModal onClose={() => setShowImportModal(false)} onImported={bumpRefresh} />
      )}
    </StudentLayout>
  );
};

// The flashcard/dictation tab body: loading -> empty -> in-progress session
// -> SessionSummary. Kept as one small local component since both tabs and
// the sidebar's due-only review all funnel through the same three states.
const PracticeSessionPanel: React.FC<{
  isLoading: boolean;
  error: string | null;
  session: SessionMode;
  result: SessionResult | null;
  onWordReviewed: () => void;
  onComplete: (result: SessionResult) => void;
  onRestart: () => void;
  onExit: () => void;
}> = ({ isLoading, error, session, result, onWordReviewed, onComplete, onRestart, onExit }) => {
  const { t } = useTranslation();

  if (isLoading) {
    return <p className="text-sm font-medium text-slate-400 dark:text-slate-500 py-10 text-center">{t.common.loading}</p>;
  }
  if (error) {
    return <p className="text-sm font-medium text-rose-500 py-10 text-center">{error}</p>;
  }
  if (!session || session.words.length === 0) {
    return (
      <p className="text-sm font-medium text-slate-400 dark:text-slate-500 py-10 text-center">
        {t.myVocab.reviewSessionEmpty}
      </p>
    );
  }
  if (result) {
    return <SessionSummary result={result} onRestart={onRestart} onExit={onExit} exitLabel={t.myVocab.backToList} />;
  }

  return session.kind === 'flashcard' ? (
    <PersonalFlashcardSession words={session.words} onComplete={onComplete} onWordReviewed={onWordReviewed} />
  ) : (
    <PersonalDictationSession words={session.words} onComplete={onComplete} onWordReviewed={onWordReviewed} />
  );
};

export default MyVocabularyPage;
