import React from 'react';
import { Check, Minus } from 'lucide-react';
import type { StreakDayStatus } from '../../../services/streakService';

interface StreakCalendarProps {
  days: StreakDayStatus[];
  locale: string;
}

// The 7-day calendar row from the Streak Detail mockup. A day only shows
// "done" once BOTH partners qualified — a day where only one side went is
// visually identical to a day neither went, since the point of the row is
// "did the streak survive this day," not "who personally studied."
const StreakCalendar: React.FC<StreakCalendarProps> = ({ days, locale }) => {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day) => {
        const bothQualified = day.meQualified && day.partnerQualified;
        // 'YYYY-MM-DD' parsed as UTC noon so the weekday label can never
        // shift a day depending on the viewer's own browser timezone.
        const label = formatter.format(new Date(`${day.day}T12:00:00.000Z`));
        return (
          <div key={day.day} className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">{label}</span>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                bothQualified
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600'
              }`}
            >
              {bothQualified ? <Check size={16} aria-hidden="true" /> : <Minus size={14} aria-hidden="true" />}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StreakCalendar;
