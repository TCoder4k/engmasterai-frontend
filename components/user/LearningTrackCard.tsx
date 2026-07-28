import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, GraduationCap, Headphones } from 'lucide-react';
import { CourseType } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';

interface LearningTrackCardProps {
  type: CourseType;
  /**
   * Real count for the footer — published lessons, decks or listening
   * lessons, computed by UserHome from the same APIs the pages themselves
   * use. `null` while it is still loading or if the request failed, in which
   * case the footer simply omits it rather than showing a fabricated 0.
   */
  count?: number | null;
}

// Sprint 05: these are the Dashboard's three module entry points, not filter
// toggles over the course grid below.
//
// Restyled to the `ai-studio-dashboard-reference` DashboardView: a tinted
// rounded tile per module, a hover lift, and a footer that pairs the module's
// size with an arrow button. Each track keeps its own hue — Grammar blue
// (the app's accent), Vocabulary cyan, Listening emerald — so the three stay
// distinguishable at a glance, which a single accent colour would lose.
//
// Icons match the reference exactly: GraduationCap / BookOpen / Headphones.
const TRACK_STYLES: Record<
  CourseType,
  {
    tileClass: string;
    hoverBorder: string;
    hoverText: string;
    hoverFoot: string;
    hoverArrow: string;
    icon: React.ReactNode;
    to: string;
  }
> = {
  GRAMMAR: {
    tileClass:
      'bg-blue-100/70 text-blue-600 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30',
    hoverBorder: 'hover:border-blue-400 dark:hover:border-blue-500/50',
    hoverText: 'group-hover:text-blue-600 dark:group-hover:text-blue-300',
    hoverFoot: 'group-hover:text-blue-600 dark:group-hover:text-blue-400',
    hoverArrow: 'group-hover:bg-blue-600 group-hover:text-white',
    icon: <GraduationCap className="w-6 h-6" aria-hidden="true" />,
    to: '/grammar',
  },
  VOCABULARY: {
    tileClass:
      'bg-cyan-100/70 text-cyan-600 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-400 dark:border-cyan-500/30',
    hoverBorder: 'hover:border-cyan-400 dark:hover:border-cyan-500/50',
    hoverText: 'group-hover:text-cyan-600 dark:group-hover:text-cyan-300',
    hoverFoot: 'group-hover:text-cyan-600 dark:group-hover:text-cyan-400',
    hoverArrow: 'group-hover:bg-cyan-600 group-hover:text-white',
    icon: <BookOpen className="w-6 h-6" aria-hidden="true" />,
    to: '/vocab',
  },
  LISTENING: {
    tileClass:
      'bg-emerald-100/70 text-emerald-600 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30',
    hoverBorder: 'hover:border-emerald-400 dark:hover:border-emerald-500/50',
    hoverText: 'group-hover:text-emerald-600 dark:group-hover:text-emerald-300',
    hoverFoot: 'group-hover:text-emerald-600 dark:group-hover:text-emerald-400',
    hoverArrow: 'group-hover:bg-emerald-600 group-hover:text-white',
    icon: <Headphones className="w-6 h-6" aria-hidden="true" />,
    to: '/practice/listening',
  },
};

const TRACK_KEYS: Record<CourseType, 'grammar' | 'vocabulary' | 'listening'> = {
  GRAMMAR: 'grammar',
  VOCABULARY: 'vocabulary',
  LISTENING: 'listening',
};

const LearningTrackCard: React.FC<LearningTrackCardProps> = ({ type, count = null }) => {
  const { t } = useTranslation();
  const style = TRACK_STYLES[type];
  const copy = t.tracks[TRACK_KEYS[type]];

  return (
    <Link
      to={style.to}
      className={`snap-start min-w-[230px] md:min-w-0 group flex flex-col justify-between gap-4 p-5 bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${style.hoverBorder}`}
    >
      <div className="space-y-3">
        <span
          className={`w-11 h-11 rounded-2xl border flex items-center justify-center group-hover:scale-110 transition-transform ${style.tileClass}`}
        >
          {style.icon}
        </span>
        <span className="block">
          <h3
            className={`text-base font-black text-slate-900 dark:text-white transition-colors ${style.hoverText}`}
          >
            {copy.label}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed">
            {copy.description}
          </p>
        </span>
      </div>

      <span
        className={`flex items-center justify-between pt-3 border-t border-slate-100 dark:border-ink-700 text-xs font-bold text-slate-500 dark:text-slate-400 transition-colors ${style.hoverFoot}`}
      >
        {/* Real count, or nothing at all — never a fabricated 0. */}
        <span>{count === null ? '' : `${count} ${copy.countUnit}`}</span>
        <span
          className={`w-7 h-7 rounded-xl bg-slate-100 dark:bg-ink-950 flex items-center justify-center transition-colors ${style.hoverArrow}`}
          aria-hidden="true"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </span>
    </Link>
  );
};

export default LearningTrackCard;
