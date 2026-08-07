import React, { useState } from 'react';
import { Eye, EyeOff, Volume2 } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';
import type { ListeningSegment } from '../../../services/listeningService';

// Sprint 11 Phase 4C — the sentence, and what the student may hide.
//
// THE SENTENCE IS SHOWN BY DEFAULT. Reading it aloud is the exercise, which is
// the whole difference from Dictation, where the same string is the answer. The
// hide toggle exists because a student who has read a line ten times wants to
// try it from memory — that is a study choice, not a mode.
//
// A TOGGLE IS ONLY RENDERED FOR DATA THAT EXISTS. `ipa` and `translationVi` are
// optional in the backend model, and a control that reveals nothing is worse
// than an absent one: it reads as broken rather than as empty.
//
// THE VISIBILITY STATE LIVES HERE, and it deliberately survives moving between
// sentences — this component keeps its position in the tree, so a student who
// hid the translation on sentence 3 does not get it back on sentence 4.

interface ShadowingReferenceCardProps {
  segment: ListeningSegment;
  onListen: () => void;
  /** False when the media cannot be driven; a broken player must not block practice. */
  listenEnabled: boolean;
}

const ShadowingReferenceCard: React.FC<ShadowingReferenceCardProps> = ({
  segment,
  onListen,
  listenEnabled,
}) => {
  const { t } = useTranslation();
  const [showSentence, setShowSentence] = useState(true);
  const [showIpa, setShowIpa] = useState(true);
  // Hidden by default: the exercise is to say the English, and a translation
  // sitting under it is the first thing the eye goes to.
  const [showTranslation, setShowTranslation] = useState(false);

  const toggle = (
    label: string,
    visible: boolean,
    onChange: (next: boolean) => void,
  ) => (
    <button
      type="button"
      onClick={() => onChange(!visible)}
      aria-pressed={visible}
      title={`${visible ? t.practice.shadowingHideAction : t.practice.shadowingShowAction} — ${label}`}
      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
        visible
          ? 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          : 'text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400'
      }`}
    >
      {/* The icon shows the CURRENT state, not the action — an eye with a line
          through it next to visible text is the convention every media player
          uses, and pairing it with `aria-pressed` keeps the meaning unambiguous
          for anyone who cannot see either. */}
      {visible ? (
        <EyeOff size={13} aria-hidden="true" />
      ) : (
        <Eye size={13} aria-hidden="true" />
      )}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-1">
        {toggle(t.practice.shadowingToggleSentence, showSentence, setShowSentence)}
        {segment.ipa && toggle(t.practice.shadowingToggleIpa, showIpa, setShowIpa)}
        {segment.translationVi &&
          toggle(t.practice.shadowingToggleTranslation, showTranslation, setShowTranslation)}
      </div>

      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {t.practice.shadowingReferenceTitle}
      </p>

      {showSentence ? (
        <p className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-slate-100 leading-snug">
          {segment.text}
        </p>
      ) : (
        // A placeholder of the right shape, so hiding the sentence does not
        // make the card collapse and the record button jump up the page.
        <p
          aria-hidden="true"
          className="text-lg sm:text-2xl font-bold text-slate-300 dark:text-slate-700 leading-snug select-none"
        >
          {segment.text.split(' ').map((word) => '•'.repeat(Math.max(2, word.length))).join(' ')}
        </p>
      )}

      {segment.ipa && showIpa && (
        <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 border-l-2 border-slate-200 dark:border-slate-700 pl-3">
          /{segment.ipa}/
        </p>
      )}

      {segment.translationVi && showTranslation && (
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 italic">
          {segment.translationVi}
        </p>
      )}

      <button
        type="button"
        onClick={onListen}
        disabled={!listenEnabled}
        className="mt-1 px-3.5 py-2.5 min-h-[44px] rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <Volume2 size={14} aria-hidden="true" />
        <span>{t.practice.shadowingListenAction}</span>
      </button>
    </div>
  );
};

export default ShadowingReferenceCard;
