import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Modal from '../../shared/Modal';
import { useTranslation } from '../../../i18n/useTranslation';
import { lookupWord } from '../../../services/dictionaryService';
import { ApiError } from '../../../services/apiError';
import {
  createPersonalVocabWord,
  updatePersonalVocabWord,
  PersonalVocabWord,
} from '../../../services/vocabPersonalService';

const LOOKUP_DEBOUNCE_MS = 500;
const MIN_LOOKUP_LENGTH = 2;

interface AddPersonalWordModalProps {
  onClose: () => void;
  onCreated: (word: PersonalVocabWord) => void;
  // Presence alone switches the modal into edit mode: fields prefill from
  // this word, the dictionary auto-lookup never runs (the student already
  // curated this content once), and submit calls PATCH instead of POST.
  // Reusing this modal rather than a near-duplicate EditPersonalWordModal —
  // the form is otherwise identical.
  editingWord?: PersonalVocabWord;
}

const fieldClass =
  'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400';
const labelClass = 'block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1';

// Manual single-word add (the mockup's "+ Thêm từ mới"): debounced
// dictionaryService.lookupWord() auto-fills IPA/meaning/audio, but every
// field stays a plain editable input — the student can overwrite anything
// before saving, and once they DO edit a field, a later-resolving lookup
// never overwrites it again (see `touchedRef`).
const AddPersonalWordModal: React.FC<AddPersonalWordModalProps> = ({ onClose, onCreated, editingWord }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isEditing = Boolean(editingWord);
  const [text, setText] = useState(editingWord?.text ?? '');
  const [ipa, setIpa] = useState(editingWord?.ipa ?? '');
  const [meaningVi, setMeaningVi] = useState(editingWord?.meaningVi ?? '');
  const [meaningEn, setMeaningEn] = useState(editingWord?.meaningEn ?? '');
  const [exampleSentence, setExampleSentence] = useState(editingWord?.exampleSentence ?? '');
  const [exampleTranslation, setExampleTranslation] = useState(editingWord?.exampleTranslation ?? '');
  const [tagsInput, setTagsInput] = useState(editingWord?.tags.join(', ') ?? '');
  const [audioUrl, setAudioUrl] = useState<string | undefined>(editingWord?.audioUrl ?? undefined);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupNotice, setLookupNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const lookupTicket = useRef(0);
  const debounceRef = useRef<number | null>(null);
  // Editing an existing word never auto-looks-up (its content is already
  // curated) — starting every field "touched" is what disables that path
  // without a separate isEditing branch scattered through handleTextChange.
  const touchedRef = useRef({
    ipa: isEditing,
    meaningVi: isEditing,
    meaningEn: isEditing,
    exampleSentence: isEditing,
  });

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
  }, []);

  const handleTextChange = (value: string) => {
    setText(value);
    setLookupNotice(null);
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);

    if (isEditing) return; // renaming an existing word never re-triggers a lookup

    const trimmed = value.trim();
    if (trimmed.length < MIN_LOOKUP_LENGTH) {
      lookupTicket.current += 1; // discard any in-flight lookup
      setIsLookingUp(false);
      return;
    }

    const ticket = (lookupTicket.current += 1);
    debounceRef.current = window.setTimeout(() => {
      setIsLookingUp(true);
      lookupWord(trimmed)
        .then((result) => {
          if (lookupTicket.current !== ticket) return; // superseded by further typing
          if (!touchedRef.current.ipa && result.ipa) setIpa(result.ipa);
          if (!touchedRef.current.meaningVi && result.viTranslation) setMeaningVi(result.viTranslation);
          const firstMeaning = result.meanings[0];
          if (!touchedRef.current.meaningEn && firstMeaning?.definitionEn) {
            setMeaningEn(firstMeaning.definitionEn);
          }
          if (!touchedRef.current.exampleSentence && firstMeaning?.exampleEn) {
            setExampleSentence(firstMeaning.exampleEn);
          }
          if (result.audioUrl) setAudioUrl(result.audioUrl);
        })
        .catch((error: unknown) => {
          if (lookupTicket.current !== ticket) return;
          // A genuine miss (404) or a rate limit (429) both just mean "no
          // auto-fill this time" — every field stays manually editable
          // regardless, so this is a notice, never a blocking error.
          if (error instanceof ApiError && error.status === 404) {
            setLookupNotice(t.myVocab.lookupFailed);
          }
        })
        .finally(() => {
          if (lookupTicket.current === ticket) setIsLookingUp(false);
        });
    }, LOOKUP_DEBOUNCE_MS);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    const trimmedText = text.trim();
    const trimmedMeaning = meaningVi.trim();
    if (!trimmedText || !trimmedMeaning) return;

    setSaveError(null);
    setLimitReached(false);
    setIsSaving(true);
    try {
      const tags = tagsInput
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      const saved = editingWord
        ? await updatePersonalVocabWord(editingWord.id, {
            text: trimmedText,
            ipa: ipa.trim() || null,
            meaningVi: trimmedMeaning,
            meaningEn: meaningEn.trim() || null,
            audioUrl: audioUrl || null,
            exampleSentence: exampleSentence.trim() || null,
            exampleTranslation: exampleTranslation.trim() || null,
            tags,
          })
        : await createPersonalVocabWord({
            text: trimmedText,
            ipa: ipa.trim() || undefined,
            meaningVi: trimmedMeaning,
            meaningEn: meaningEn.trim() || undefined,
            audioUrl,
            exampleSentence: exampleSentence.trim() || undefined,
            exampleTranslation: exampleTranslation.trim() || undefined,
            tags: tags.length > 0 ? tags : undefined,
          });
      onCreated(saved);
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VOCAB_WORD_LIMIT_REACHED') {
        setLimitReached(true);
      } else {
        setSaveError(
          error instanceof ApiError && error.status === 409
            ? t.myVocab.wordAlreadyExists
            : t.myVocab.saveFailed,
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal title={isEditing ? t.myVocab.editWord : t.myVocab.addModalTitle} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="personal-word-text" className={labelClass}>{t.myVocab.wordLabel}</label>
          <div className="relative">
            {/* eslint-disable-next-line jsx-a11y/no-autofocus -- opening this modal is itself the user's intent to type a word */}
            <input
              id="personal-word-text"
              autoFocus
              type="text"
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder={t.myVocab.wordPlaceholder}
              required
              className={`${fieldClass} font-semibold pr-9`}
            />
            {isLookingUp && (
              <Loader2
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
                aria-hidden="true"
              />
            )}
          </div>
          {lookupNotice && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{lookupNotice}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="personal-word-ipa" className={labelClass}>{t.myVocab.ipaLabel}</label>
            <input
              id="personal-word-ipa"
              type="text"
              value={ipa}
              onChange={(e) => {
                touchedRef.current.ipa = true;
                setIpa(e.target.value);
              }}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="personal-word-tags" className={labelClass}>{t.myVocab.tagsLabel}</label>
            <input
              id="personal-word-tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder={t.myVocab.tagsPlaceholder}
              className={fieldClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="personal-word-meaning-vi" className={labelClass}>{t.myVocab.meaningViLabel}</label>
          <input
            id="personal-word-meaning-vi"
            type="text"
            value={meaningVi}
            onChange={(e) => {
              touchedRef.current.meaningVi = true;
              setMeaningVi(e.target.value);
            }}
            required
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="personal-word-meaning-en" className={labelClass}>{t.myVocab.meaningEnLabel}</label>
          <input
            id="personal-word-meaning-en"
            type="text"
            value={meaningEn}
            onChange={(e) => {
              touchedRef.current.meaningEn = true;
              setMeaningEn(e.target.value);
            }}
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="personal-word-example-sentence" className={labelClass}>{t.myVocab.exampleSentenceLabel}</label>
          <input
            id="personal-word-example-sentence"
            type="text"
            value={exampleSentence}
            onChange={(e) => {
              touchedRef.current.exampleSentence = true;
              setExampleSentence(e.target.value);
            }}
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="personal-word-example-translation" className={labelClass}>{t.myVocab.exampleTranslationLabel}</label>
          <input
            id="personal-word-example-translation"
            type="text"
            value={exampleTranslation}
            onChange={(e) => setExampleTranslation(e.target.value)}
            className={fieldClass}
          />
        </div>

        {limitReached ? (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/20 dark:bg-amber-500/10"
          >
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
              {t.myVocab.limitReachedMessage}
            </p>
            <button
              type="button"
              onClick={() => navigate('/checkout')}
              className="self-start rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition-colors"
            >
              {t.myVocab.limitReachedCta}
            </button>
          </div>
        ) : (
          saveError && (
            <p role="alert" className="text-xs font-semibold text-rose-500">
              {saveError}
            </p>
          )
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {t.common.cancel}
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isSaving ? t.myVocab.saving : t.myVocab.save}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddPersonalWordModal;
