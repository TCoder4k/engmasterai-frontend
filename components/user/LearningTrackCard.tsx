import React from 'react';
import { ArrowRight, BookOpen, BookMarked, Headphones } from 'lucide-react';
import { CourseType } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';

interface LearningTrackCardProps {
  type: CourseType;
  active: boolean;
  onSelect: () => void;
}

const TRACK_STYLES: Record<CourseType, { tileClass: string; icon: React.ReactNode }> = {
  GRAMMAR: {
    tileClass: 'bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-400',
    icon: <BookOpen size={24} />,
  },
  VOCABULARY: {
    tileClass: 'bg-violet-50 text-violet-500 dark:bg-violet-500/10 dark:text-violet-400',
    icon: <BookMarked size={24} />,
  },
  LISTENING: {
    tileClass: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-400',
    icon: <Headphones size={24} />,
  },
};

const TRACK_KEYS: Record<CourseType, 'grammar' | 'vocabulary' | 'listening'> = {
  GRAMMAR: 'grammar',
  VOCABULARY: 'vocabulary',
  LISTENING: 'listening',
};

// Toggles a CourseType filter on the recommended grid (real data — course
// types are real; no fabricated lesson counts are shown). aria-pressed
// conveys the filter state to assistive tech.
const LearningTrackCard: React.FC<LearningTrackCardProps> = ({ type, active, onSelect }) => {
  const { t } = useTranslation();
  const style = TRACK_STYLES[type];
  const copy = t.tracks[TRACK_KEYS[type]];

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`snap-start min-w-[230px] md:min-w-0 text-left bg-white dark:bg-slate-900 rounded-2xl border p-5 transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
        active
          ? 'border-indigo-300 ring-2 ring-indigo-100 dark:border-indigo-500 dark:ring-indigo-500/20'
          : 'border-slate-100 dark:border-slate-800 shadow-sm'
      }`}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${style.tileClass}`} aria-hidden="true">
        {style.icon}
      </div>
      <h3 className="text-[15px] font-extrabold text-slate-900 dark:text-slate-100">{copy.label}</h3>
      <p className="text-[13px] text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed">
        {copy.description}
      </p>
      <div className="flex items-center justify-end mt-5">
        <span
          className="w-9 h-9 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400"
          aria-hidden="true"
        >
          <ArrowRight size={15} />
        </span>
      </div>
    </button>
  );
};

export default LearningTrackCard;
