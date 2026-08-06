import React from 'react';
import { MicOff, ShieldAlert } from 'lucide-react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { recordingErrorMessage } from './recordingErrorCopy';
import type { RecordingErrorKind } from './recordingService';

// Sprint 11 Phase 3 — the surface for failures a retry cannot fix.
//
// NOT A MODAL, DELIBERATELY. The name in the approved scope is
// "PermissionDialog", and this is `role="alertdialog"` — but it does not trap
// focus or cover the page. A blocked microphone must not stand between the
// student and the sentence list, the player or Dictation, all of which still
// work; and the fix lives in browser chrome that a focus trap makes harder to
// reach. So it announces itself as a dialog to assistive technology and renders
// as an inline panel.
//
// RETRY ONLY WHERE RETRY MEANS SOMETHING. A denial can be reversed in site
// settings, so those get a button. An engine with no MediaRecorder, or a page
// served over plain http, cannot be fixed from this page — offering "try again"
// there would be a button whose only function is to fail again.

interface RecordingPermissionDialogProps {
  kind: RecordingErrorKind;
  onRetry: () => void;
}

const RETRYABLE: RecordingErrorKind[] = ['PERMISSION_DENIED', 'PERMISSION_REVOKED'];

const RecordingPermissionDialog: React.FC<RecordingPermissionDialogProps> = ({
  kind,
  onRetry,
}) => {
  const { t } = useTranslation();
  const blocked = kind === 'PERMISSION_DENIED' || kind === 'PERMISSION_REVOKED';

  return (
    <div
      role="alertdialog"
      aria-labelledby="recording-permission-title"
      className="p-4 rounded-2xl border-2 border-amber-200 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 space-y-2"
    >
      <h3
        id="recording-permission-title"
        className="flex items-center gap-2 text-xs font-black text-amber-800 dark:text-amber-300"
      >
        {blocked ? (
          <MicOff size={15} aria-hidden="true" />
        ) : (
          <ShieldAlert size={15} aria-hidden="true" />
        )}
        <span>{t.practice.shadowingPermissionTitle}</span>
      </h3>

      <p className="text-[12px] font-semibold text-amber-800 dark:text-amber-300/90">
        {recordingErrorMessage(t, kind)}
      </p>

      {blocked && (
        <ol className="list-decimal list-inside space-y-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400/90">
          <li>{t.practice.shadowingPermissionStep1}</li>
          <li>{t.practice.shadowingPermissionStep2}</li>
          <li>{t.practice.shadowingPermissionStep3}</li>
        </ol>
      )}

      {RETRYABLE.includes(kind) && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 px-3.5 py-2 min-h-[44px] rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-500/50 text-amber-800 dark:text-amber-300 text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          {t.common.tryAgain}
        </button>
      )}
    </div>
  );
};

export default RecordingPermissionDialog;
