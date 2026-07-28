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
          // Sprint 06B.5 — smooth scroll instead of a hard jump. Handled in
          // JS rather than via CSS scroll-behavior so it stays scoped to
          // these chips and does not change scrolling anywhere else in the
          // app. Falls back to the plain anchor if anything goes wrong, and
          // still updates the hash so the link remains shareable.
          onClick={(e) => {
            const target = document.getElementById(`section-${section.index}`);
            if (!target) return; // let the browser handle it
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            window.history.replaceState(null, '', `#section-${section.index}`);
          }}
          className="flex-shrink-0 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 rounded-full whitespace-nowrap transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 hover:bg-blue-100 dark:hover:bg-blue-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {section.heading}
        </a>
      ))}
    </nav>
  );
};

export default LessonOutline;
