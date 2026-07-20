import React from 'react';
import { GrammarSection } from './parseGrammarNotes';

interface LessonOutlineProps {
  sections: GrammarSection[];
}

// In-page jump list of grammar sections actually present in this lesson's
// notes (design doc §7.3/§7.8) — collapses to a horizontal chip scroller,
// matching the existing overflow-x-auto snap-x pattern used by UserHome's
// Learning Tracks carousel. Indices line up 1:1 with GrammarLessonContent's
// `section-${index}` anchor ids.
const LessonOutline: React.FC<LessonOutlineProps> = ({ sections }) => {
  const headed = sections
    .map((section, index) => ({ ...section, index }))
    .filter((section) => section.heading);

  if (headed.length === 0) return null;

  return (
    <nav aria-label="Lesson sections" className="flex overflow-x-auto gap-2 -mx-1 px-1 pb-1">
      {headed.map((section) => (
        <a
          key={`${section.heading}-${section.index}`}
          href={`#section-${section.index}`}
          className="flex-shrink-0 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-full whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          {section.heading}
        </a>
      ))}
    </nav>
  );
};

export default LessonOutline;
