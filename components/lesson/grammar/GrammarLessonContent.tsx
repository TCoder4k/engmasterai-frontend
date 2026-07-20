import React from 'react';
import { ParsedGrammarNotes } from './parseGrammarNotes';
import { useTranslation } from '../../../i18n/useTranslation';

interface GrammarLessonContentProps {
  parsed: ParsedGrammarNotes;
}

// Renders already-parsed grammar notes (design doc §7.3) — sectioned when
// the recognized heading convention was used, or one plain fallback block
// otherwise. Returns null for a video-only lesson (nothing to render).
const GrammarLessonContent: React.FC<GrammarLessonContentProps> = ({ parsed }) => {
  const { t } = useTranslation();

  if (!parsed.sections.length && !parsed.fallbackText) {
    return null;
  }

  if (parsed.fallbackText) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm dark:border dark:border-slate-800 p-6">
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mb-2">
          {t.lesson.notesFallbackTitle}
        </h3>
        <p className="text-[14px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-wrap">
          {parsed.fallbackText}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {parsed.sections.map((section, index) => (
        <div
          key={`${section.heading}-${index}`}
          id={section.heading ? `section-${index}` : undefined}
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm dark:border dark:border-slate-800 p-6 scroll-mt-24"
        >
          {section.heading && (
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mb-2">{section.heading}</h3>
          )}
          <p className="text-[14px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-wrap">
            {section.body}
          </p>
        </div>
      ))}
    </div>
  );
};

export default GrammarLessonContent;
