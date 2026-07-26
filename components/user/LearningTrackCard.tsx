import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, BookMarked, Headphones } from 'lucide-react';
import { CourseType } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';

interface LearningTrackCardProps {
  type: CourseType;
}

const TRACK_STYLES: Record<CourseType, { tileClass: string; icon: React.ReactNode; to: string }> = {
  GRAMMAR: {
    tileClass: 'bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-400',
    icon: <BookOpen size={24} />,
    to: '/grammar',
  },
  VOCABULARY: {
    tileClass: 'bg-violet-50 text-violet-500 dark:bg-violet-500/10 dark:text-violet-400',
    icon: <BookMarked size={24} />,
    to: '/vocab',
  },
  LISTENING: {
    tileClass: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-400',
    icon: <Headphones size={24} />,
    to: '/practice/listening',
  },
};

const TRACK_KEYS: Record<CourseType, 'grammar' | 'vocabulary' | 'listening'> = {
  GRAMMAR: 'grammar',
  VOCABULARY: 'vocabulary',
  LISTENING: 'listening',
};

// Sprint 05: these are now the Dashboard's three module entry points, not
// filter toggles over the course grid below. The product model is
// Grammar / Vocabulary / Listening as modules — Course is implementation —
// so the obvious click here is "take me into that module", which is also
// what replaced the removed Dashboard search as the way to narrow down.
// No counts or progress are shown: Grammar has no progress backend at all,
// and inventing parity numbers across three modules would be fabrication.
const LearningTrackCard: React.FC<LearningTrackCardProps> = ({ type }) => {
  const { t } = useTranslation();
  const style = TRACK_STYLES[type];
  const copy = t.tracks[TRACK_KEYS[type]];

  return (
    <Link
      to={style.to}
      className="snap-start min-w-[230px] md:min-w-0 group block bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 transition-all hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${style.tileClass}`} aria-hidden="true">
        {style.icon}
      </div>
      <h3 className="text-[15px] font-extrabold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
        {copy.label}
      </h3>
      <p className="text-[13px] text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed">
        {copy.description}
      </p>
      <div className="flex items-center justify-end mt-5">
        <span
          className="w-9 h-9 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 transition-transform group-hover:translate-x-1"
          aria-hidden="true"
        >
          <ArrowRight size={15} />
        </span>
      </div>
    </Link>
  );
};

export default LearningTrackCard;
