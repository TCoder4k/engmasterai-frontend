import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import Modal from '../../shared/Modal';
import { useTranslation } from '../../../i18n/useTranslation';
import { lookupWord, DictionaryLookupResult } from '../../../services/dictionaryService';
import { ApiError } from '../../../services/apiError';
import {
  bulkCreatePersonalVocabWords,
  CreatePersonalVocabWordInput,
} from '../../../services/vocabPersonalService';

// The backend's real GET /dictionary/lookup limit (dictionary.controller.ts/
// dictionary-rate-limit.guard.ts, confirmed by reading both, not assumed):
// 40 requests per rolling-fixed 60s window, keyed per authenticated user.
// 60000/40 = 1500ms is the conservative fixed spacing that can never exceed
// the limit regardless of where the window happens to land.
const LOOKUP_INTERVAL_MS = 1500;
// A 429 mid-batch is not a permanent failure for that word — pause and
// retry it, up to a small bound so a persistently-throttled session still
// terminates rather than looping forever.
const RATE_LIMIT_BACKOFF_MS = 5000;
const MAX_RATE_LIMIT_RETRIES = 3;
const MAX_IMPORT_LINES = 200; // mirrors the backend's own BulkCreatePersonalVocabWordsDto cap

type RowStatus = 'pending' | 'looking-up' | 'rate-limited' | 'resolved' | 'unresolved';

interface ImportRow {
  id: string;
  text: string;
  status: RowStatus;
  ipa?: string;
  meaningVi: string;
  meaningEn?: string;
  audioUrl?: string;
  exampleSentence?: string;
  exampleTranslation?: string;
}

type Phase = 'input' | 'resolving' | 'review' | 'submitting' | 'result';

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
const normalize = (text: string): string => text.trim().toLowerCase();

interface ImportPersonalWordsModalProps {
  onClose: () => void;
  // Called once, after a successful bulk save, so the caller can refresh
  // its list/stats — this modal does not know about either.
  onImported: () => void;
}

// Bulk/paste import (the mockup's "Nhập từ vựng"): one word per line, each
// resolved client-side via the existing dictionaryService.lookupWord() —
// see the approved plan's rate-limit section for why the pacing/retry logic
// below is shaped the way it is. The backend's own bulk endpoint stays the
// sole dedup AUTHORITY (its @@unique([userId, textNormalized]) constraint);
// this modal's own normalize() cache is purely a lookup-cost optimization
// so pasting "Apple" and "apple" doesn't cost two dictionary calls.
const ImportPersonalWordsModal: React.FC<ImportPersonalWordsModalProps> = ({ onClose, onImported }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rawInput, setRawInput] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [isRateLimitPaused, setIsRateLimitPaused] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [result, setResult] = useState<{ createdCount: number; skippedCount: number } | null>(null);
  const cancelledRef = useRef(false);

  const updateRow = (id: string, patch: Partial<ImportRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const handleStartLookup = async () => {
    const lines = rawInput
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, MAX_IMPORT_LINES);
    if (lines.length === 0) return;

    const initialRows: ImportRow[] = lines.map((text, index) => ({
      id: `${index}-${text}`,
      text,
      status: 'pending',
      meaningVi: '',
    }));
    setRows(initialRows);
    setPhase('resolving');
    cancelledRef.current = false;

    const cache = new Map<string, DictionaryLookupResult | null>();
    for (const row of initialRows) {
      if (cancelledRef.current) return;
      updateRow(row.id, { status: 'looking-up' });

      const key = normalize(row.text);
      let cached = cache.get(key);
      if (cached === undefined) {
        let attempt = 0;
        let outcome: DictionaryLookupResult | null = null;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          try {
            outcome = await lookupWord(row.text);
            break;
          } catch (error) {
            const isRateLimited = error instanceof ApiError && error.status === 429;
            if (isRateLimited && attempt < MAX_RATE_LIMIT_RETRIES) {
              attempt += 1;
              setIsRateLimitPaused(true);
              updateRow(row.id, { status: 'rate-limited' });
              await sleep(RATE_LIMIT_BACKOFF_MS);
              setIsRateLimitPaused(false);
              continue;
            }
            outcome = null; // a genuine miss (404), or gave up retrying a 429
            break;
          }
        }
        cached = outcome;
        cache.set(key, cached);
      }

      if (cancelledRef.current) return;

      if (cached) {
        const firstMeaning = cached.meanings[0];
        updateRow(row.id, {
          status: 'resolved',
          ipa: cached.ipa ?? undefined,
          meaningVi: cached.viTranslation ?? '',
          meaningEn: firstMeaning?.definitionEn ?? undefined,
          audioUrl: cached.audioUrl ?? undefined,
          exampleSentence: firstMeaning?.exampleEn ?? undefined,
        });
      } else {
        updateRow(row.id, { status: 'unresolved' });
      }

      await sleep(LOOKUP_INTERVAL_MS);
    }

    if (!cancelledRef.current) setPhase('review');
  };

  const handleClose = () => {
    cancelledRef.current = true;
    onClose();
  };

  const removeRow = (id: string) => setRows((prev) => prev.filter((row) => row.id !== id));

  const canSubmit = rows.length > 0 && rows.every((row) => row.meaningVi.trim().length > 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitError(null);
    setLimitReached(false);
    setPhase('submitting');
    try {
      const words: CreatePersonalVocabWordInput[] = rows.map((row) => ({
        text: row.text,
        ipa: row.ipa,
        meaningVi: row.meaningVi.trim(),
        meaningEn: row.meaningEn,
        audioUrl: row.audioUrl,
        exampleSentence: row.exampleSentence,
        exampleTranslation: row.exampleTranslation,
      }));
      const res = await bulkCreatePersonalVocabWords(words);
      setResult({ createdCount: res.createdCount, skippedCount: res.skippedCount });
      setPhase('result');
      onImported();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VOCAB_WORD_LIMIT_REACHED') {
        setLimitReached(true);
      } else {
        setSubmitError(t.myVocab.saveFailed);
      }
      setPhase('review');
    }
  };

  return (
    <Modal title={t.myVocab.importModalTitle} onClose={handleClose}>
      {phase === 'input' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.myVocab.importInstructions}</p>
          <textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder={t.myVocab.importTextareaPlaceholder}
            rows={10}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              onClick={handleStartLookup}
              disabled={rawInput.trim().length === 0}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {t.myVocab.importSubmit}
            </button>
          </div>
        </div>
      )}

      {phase === 'resolving' && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            {isRateLimitPaused ? t.myVocab.importRateLimited : t.myVocab.importLookingUp}
          </p>
          <ImportRowList rows={rows} editable={false} />
        </div>
      )}

      {(phase === 'review' || phase === 'submitting') && (
        <div className="space-y-4">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{t.myVocab.importReviewTitle}</p>
          <ImportRowList
            rows={rows}
            editable={phase === 'review'}
            onMeaningChange={(id, value) => updateRow(id, { meaningVi: value })}
            onRemove={removeRow}
          />
          {limitReached ? (
            <div
              role="alert"
              className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/20 dark:bg-amber-500/10"
            >
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                {t.myVocab.limitReachedMessageBulk}
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
            submitError && (
              <p role="alert" className="text-xs font-semibold text-rose-500">
                {submitError}
              </p>
            )
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || phase === 'submitting'}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {phase === 'submitting' ? t.myVocab.importSubmitting : t.myVocab.importSubmit}
            </button>
          </div>
        </div>
      )}

      {phase === 'result' && result && (
        <div className="space-y-5 text-center py-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center">
            <CheckCircle2 size={26} aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {result.createdCount} {t.myVocab.importResultCreated}
            {result.skippedCount > 0 && (
              <>
                {' · '}
                {result.skippedCount} {t.myVocab.importResultSkipped}
              </>
            )}
          </p>
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:opacity-90 transition-opacity"
          >
            {t.common.close}
          </button>
        </div>
      )}
    </Modal>
  );
};

const ROW_STATUS_STYLE: Record<RowStatus, string> = {
  pending: 'text-slate-300 dark:text-slate-600',
  'looking-up': 'text-blue-500 dark:text-blue-400',
  'rate-limited': 'text-amber-500 dark:text-amber-400',
  resolved: 'text-emerald-600 dark:text-emerald-400',
  unresolved: 'text-amber-600 dark:text-amber-400',
};

const ImportRowList: React.FC<{
  rows: ImportRow[];
  editable: boolean;
  onMeaningChange?: (id: string, value: string) => void;
  onRemove?: (id: string) => void;
}> = ({ rows, editable, onMeaningChange, onRemove }) => {
  const { t } = useTranslation();
  return (
    <ul className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center gap-3 px-3.5 py-2.5">
          {row.status === 'looking-up' || row.status === 'rate-limited' ? (
            <Loader2 size={14} className="shrink-0 animate-spin text-blue-400" aria-hidden="true" />
          ) : row.status === 'unresolved' ? (
            <AlertTriangle size={14} className="shrink-0 text-amber-500" aria-hidden="true" />
          ) : row.status === 'resolved' ? (
            <CheckCircle2 size={14} className="shrink-0 text-emerald-500" aria-hidden="true" />
          ) : (
            <span className="shrink-0 w-3.5 h-3.5 rounded-full border-2 border-slate-200 dark:border-slate-700" />
          )}
          <span className="shrink-0 text-sm font-bold text-slate-800 dark:text-slate-100 w-28 truncate">
            {row.text}
          </span>
          {editable ? (
            <input
              type="text"
              value={row.meaningVi}
              onChange={(e) => onMeaningChange?.(row.id, e.target.value)}
              placeholder={row.status === 'unresolved' ? t.myVocab.importUnresolved : t.myVocab.meaningViLabel}
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          ) : (
            <span className={`flex-1 min-w-0 truncate text-xs ${ROW_STATUS_STYLE[row.status]}`}>
              {row.meaningVi || (row.status === 'unresolved' ? t.myVocab.importUnresolved : '')}
            </span>
          )}
          {editable && onRemove && (
            <button
              type="button"
              onClick={() => onRemove(row.id)}
              aria-label={t.myVocab.deleteWord}
              className="shrink-0 p-1 text-slate-300 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400"
            >
              <X size={14} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
};

export default ImportPersonalWordsModal;
