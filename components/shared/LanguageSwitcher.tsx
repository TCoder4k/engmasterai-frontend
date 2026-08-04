import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Language } from '../../i18n/translations';
import { useTranslation } from '../../i18n/useTranslation';
import LanguageFlag from './LanguageFlag';

const LANGUAGES: Language[] = ['en', 'vi'];

// "🇻🇳 Tiếng Việt ⌄" dropdown (flags are inline SVG, not emoji — see
// LanguageFlag for why that distinction matters on Windows).
//
// The flag is decorative: it sits beside the language NAME, never instead of
// it, so the control still reads correctly to a screen reader and to anyone
// who does not recognise a flag. Follows AvatarMenu's accessibility
// pattern: click-outside + Escape close, visible focus rings, native buttons
// for keyboard operability.
const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const selectLanguage = (next: Language) => {
    setLanguage(next);
    setIsOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={t.header.changeLanguage}
        title={t.header.changeLanguage}
        className="h-10 md:h-11 px-2.5 md:px-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-200 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:text-blue-400 dark:hover:border-slate-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <LanguageFlag language={language} label={t.languages[language]} />
        {/* The full name on wider viewports, the code on phones — "Tiếng Việt"
            beside an avatar and a theme toggle is more than a narrow header
            can hold. */}
        <span className="hidden sm:inline text-sm font-semibold whitespace-nowrap">
          {t.languages[language]}
        </span>
        <span className="sm:hidden text-xs font-bold uppercase">{language}</span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <ul
          role="listbox"
          aria-label={t.header.changeLanguage}
          className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden z-50 py-1"
        >
          {LANGUAGES.map((lang) => (
            <li key={lang} role="option" aria-selected={language === lang}>
              <button
                type="button"
                onClick={() => selectLanguage(lang)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400 ${
                  language === lang
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-500/10'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <LanguageFlag language={lang} label={t.languages[lang]} />
                  {t.languages[lang]}
                </span>
                {language === lang && <Check size={14} aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LanguageSwitcher;
