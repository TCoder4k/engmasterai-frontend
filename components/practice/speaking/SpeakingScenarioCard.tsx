
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { getLevelStyle, resolveScenarioVisual } from './scenarioVisuals';
import type { CefrLevel } from '../../../types';

interface SpeakingScenarioCardProps {
  id: string;
  /** Server-authored, stable English name — drives icon resolution, never rendered directly here. */
  name: string;
  title: string;
  description: string | null;
  level: CefrLevel | null;
}

const SpeakingScenarioCard: React.FC<SpeakingScenarioCardProps> = ({ id, name, title, description, level }) => {
  const visual = resolveScenarioVisual(name);
  const Icon = visual.icon;

  return (
    <Link
      to={`/practice/speaking/${id}`}
      className="group flex items-center gap-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 dark:hover:border-blue-500/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
    >
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${visual.className}`}>
        <Icon size={22} strokeWidth={2} aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h3>
          {level && (
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${getLevelStyle(level)}`}>
              {level}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>

      <ChevronRight
        size={18}
        className="shrink-0 text-slate-300 dark:text-slate-600 transition-all group-hover:translate-x-1 group-hover:text-blue-500"
        aria-hidden="true"
      />
    </Link>
  );
};

export default SpeakingScenarioCard;
