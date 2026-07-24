import React from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from '../user/StudentLayout';
import EmptyState from '../shared/EmptyState';
import { useTranslation } from '../../i18n/useTranslation';
import { BookMarked, Headphones, SpellCheck2 } from 'lucide-react';

// /practice — kept as an internal compatibility route only (Sprint 03D).
// Primary student navigation no longer points here: Vocabulary practice is
// reached via the Vocabulary section (/vocab -> library -> deck ->
// Flashcard) and Listening has its own dedicated nav item
// (/practice/listening). This page is now a simple set of link-out cards,
// not a duplicate deck picker — see the practice migration plan's Sprint
// 03D decision log for why the previous embedded PracticeDeckPicker was
// removed rather than kept as a second, competing vocabulary entry point.
const PracticeHubPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <StudentLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-[22px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
            {t.practice.title}
          </h2>
          <div className="h-1 w-12 bg-gradient-to-r from-indigo-500 to-violet-500 mt-2.5 rounded-full" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-3">{t.practice.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to="/vocab"
            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:border-indigo-200 dark:hover:border-indigo-500/40 hover:shadow-md transition-all flex items-center gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <BookMarked size={22} aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{t.nav.vocabulary}</p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t.practice.vocabularySection}</p>
            </div>
          </Link>

          <Link
            to="/practice/listening"
            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:border-indigo-200 dark:hover:border-indigo-500/40 hover:shadow-md transition-all flex items-center gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-white flex items-center justify-center shrink-0">
              <Headphones size={22} aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{t.nav.listening}</p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t.practice.modeListeningDesc}</p>
            </div>
          </Link>
        </div>

        <EmptyState icon={<SpellCheck2 size={32} />} message={`${t.practice.grammarSection}: ${t.common.comingSoon}`} />
      </div>
    </StudentLayout>
  );
};

export default PracticeHubPage;
