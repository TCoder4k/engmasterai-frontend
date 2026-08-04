import React from 'react';
import { Language } from '../../i18n/translations';

// Flags for the language switcher, served from the shared asset CDN.
//
// NOT emoji: Windows has no flag glyphs in its emoji font, so `🇻🇳` renders as
// the bare region letters "VN" there — broken for most of this project's users
// and fine for whoever added it.
//
// These are remote <img>, so unlike the rest of the header they depend on a
// third-party host being up. `alt` carries the language name for that case, and
// the box keeps its size either way, so a failed load degrades to a label
// rather than shifting the whole control cluster.
const FLAG_SRC: Record<Language, string> = {
  vi: 'https://assets.parroto.app/images/flags/vn.svg',
  en: 'https://assets.parroto.app/images/flags/en.svg',
};

/**
 * The flag for a language, sized to sit inline with text.
 *
 * Rounded with a hairline ring so a mostly-white flag still reads as an object
 * against a white header instead of dissolving into it.
 */
const LanguageFlag: React.FC<{
  language: Language;
  /** The language's own name — used as alt text if the image fails. */
  label: string;
  className?: string;
}> = ({ language, label, className = '' }) => (
  <img
    src={FLAG_SRC[language]}
    alt={label}
    width={20}
    height={14}
    loading="lazy"
    decoding="async"
    className={`w-5 h-3.5 shrink-0 rounded-[2px] object-cover ring-1 ring-black/10 dark:ring-white/15 ${className}`}
  />
);

export default LanguageFlag;
