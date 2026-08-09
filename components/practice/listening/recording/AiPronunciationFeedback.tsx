import React, { useCallback, useState } from 'react';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { ApiError, AuthExpiredError } from '../../../../services/apiError';
import { requestShadowingFeedback } from '../../../../services/listeningService';

// Sprint 11 Phase 4C — optional AI coaching on an attempt already graded.
//
// >>> THIS RENDERS NO NUMBER, AND THE RESPONSE CARRIES NONE. <<<
// The attempt above already has exactly one figure, computed by the server from
// the alignment. A second number here — a rating, a confidence, a "pronunciation
// score" — would be a fabricated measurement standing beside a real one, and a
// student cannot tell them apart.
//
// IT IS AN EXPLICIT SECOND ACTION, not part of submitting. It costs money at an
// external provider, it re-uploads the recording, and most students on most
// sentences will not want it. Attaching it to every submission would bill every
// attempt for prose nobody read.
//
// A FAILURE HERE IS HARMLESS AND THE COPY SAYS SO. The verdict is already
// earned and stored; feedback failing changes nothing about it. That is why
// this renders an inline message rather than anything that looks like the
// result being in doubt.

interface AiPronunciationFeedbackProps {
  segmentId: string;
  /** The SAME key the attempt was submitted under — that is what makes it free to retry. */
  clientAttemptId: string | null;
  /** The recording, still in hand. Null means there is nothing to send. */
  audio: Blob | null;
}

const AiPronunciationFeedback: React.FC<AiPronunciationFeedbackProps> = ({
  segmentId,
  clientAttemptId,
  audio,
}) => {
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequest = useCallback(async () => {
    if (!clientAttemptId || !audio) return;
    setLoading(true);
    setError(null);
    try {
      const result = await requestShadowingFeedback(segmentId, {
        clientAttemptId,
        audio,
      });
      setFeedback(result.feedback);
    } catch (caught) {
      // Each failure gets its own sentence, because the recoveries differ — the
      // same discipline the submit path follows. What none of them says is that
      // anything happened to the score.
      if (caught instanceof AuthExpiredError) {
        setError(t.practice.shadowingErrorSessionExpired);
      } else if (caught instanceof ApiError && caught.status === 429) {
        setError(t.practice.shadowingAiFeedbackErrorRateLimited);
      } else if (
        caught instanceof ApiError &&
        (caught.status === 503 || caught.status === 400)
      ) {
        setError(t.practice.shadowingAiFeedbackErrorUnavailable);
      } else {
        setError(t.practice.shadowingAiFeedbackErrorFailed);
      }
    } finally {
      setLoading(false);
    }
  }, [segmentId, clientAttemptId, audio, t]);

  // No attempt key or no recording means there is nothing this could ask about.
  if (!clientAttemptId || !audio) return null;

  if (feedback) {
    return (
      <div
        className="p-3 rounded-2xl bg-blue-50 dark:bg-[#0F172A] border border-blue-300 dark:border-[#00A3FF]/40 space-y-2"
        data-testid="ai-pronunciation-feedback"
      >
        <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-blue-700 dark:text-[#00A3FF]">
          <Sparkles size={13} aria-hidden="true" />
          {t.practice.shadowingAiFeedbackTitle}
        </p>
        {/* `whitespace-pre-line` because the model writes paragraphs and
            flattening them turns three pieces of advice into one wall. */}
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 whitespace-pre-line">
          {feedback}
        </p>
        {/* Stated under the advice, every time. A student who reads coaching
            without knowing what produced it will treat it as an assessment. */}
        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-500">
          {t.practice.shadowingAiFeedbackDisclaimer}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void handleRequest()}
        disabled={loading}
        className="w-full px-4 py-3 min-h-[44px] rounded-2xl bg-blue-50 dark:bg-[#00A3FF]/10 border border-blue-300 dark:border-[#00A3FF]/40 text-blue-700 dark:text-[#00A3FF] text-sm font-bold flex items-center justify-center gap-2 transition-colors hover:bg-blue-100 dark:hover:bg-[#00A3FF]/20 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        {loading ? (
          <Loader2 size={16} aria-hidden="true" className="motion-safe:animate-spin" />
        ) : (
          <Sparkles size={16} aria-hidden="true" />
        )}
        <span>
          {loading
            ? t.practice.shadowingAiFeedbackLoading
            : t.practice.shadowingAiFeedbackAction}
        </span>
      </button>

      {/* Said at the moment of the decision — the recording goes up a second
          time, and a student should know that before they press, not after. */}
      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-500">
        {t.practice.shadowingAiFeedbackNote}
      </p>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400"
        >
          <AlertCircle size={13} aria-hidden="true" className="mt-px shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};

export default AiPronunciationFeedback;
