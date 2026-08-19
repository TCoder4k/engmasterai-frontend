import React, { useCallback } from 'react';
import { Loader2, Mic, Square } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useSpeakingLiveCapture } from './useSpeakingLiveCapture';
import { recordingErrorMessage } from '../listening/recording/recordingErrorCopy';
import SpeakingVoiceWave from './SpeakingVoiceWave';
import { playRecordStart, playRecordStop } from '../../../services/feedbackSounds';

// Sound is a best-effort side effect and must NEVER be able to block the
// actual start()/stop() call. feedbackSounds.ts's own play* functions
// already never throw (every entry point there is try/catch-wrapped), but
// this call site does not rely on that alone — recording correctness must
// hold even if that contract were ever violated, not just today.
const playSafely = (play: () => void): void => {
  try {
    play();
  } catch {
    // Never let a sound failure affect the recording flow.
  }
};

// Speaking Partner — the tap-to-talk mic control + waveform, now streaming
// 16kHz PCM16 to Gemini Live instead of recording one MediaRecorder blob
// per turn (see useSpeakingLiveCapture.ts). Same tap-to-toggle UX, same
// violet gradient/glow, same real-level-driven SpeakingVoiceWave — only the
// mechanics underneath `onClick` changed.
//
// THE H1 RACE IS NOW HANDLED INSIDE useSpeakingLiveCapture ITSELF, not by a
// guard built around this component — see that hook's own header. A tap
// landing during REQUESTING_PERMISSION is simply `capture.stop()`, no local
// ref/effect needed here anymore.
//
// `onRecordingStart`/`onRecordingStop` map straight to the Live WS's
// `activityStart`/`activityEnd` — the parent (SpeakingSessionPage) owns the
// one long-lived socket for the whole conversation and wires these two
// calls to it, exactly the way it already owns `onAudioChunk`.
const SpeakingRecorderControl: React.FC<{
  onAudioChunk: (base64Pcm16: string) => void;
  onRecordingStart: () => void;
  onRecordingStop: () => void;
  /** True while the parent is awaiting/playing a reply for a PREVIOUS turn. */
  disabled?: boolean;
  maxDurationMs?: number;
  /** The student's chosen microphone (Shadowing's own resolved `useMicrophones().selected.deviceId`) — see useSpeakingLiveCapture's own header for why this matters. */
  deviceId?: string | null;
  /** True while the AI's reply is being spoken — animates the wings with an
   * honest indeterminate pulse (no real mic signal exists then), never the
   * real level meter. */
  isAiSpeaking?: boolean;
}> = ({
  onAudioChunk,
  onRecordingStart,
  onRecordingStop,
  disabled = false,
  maxDurationMs,
  deviceId,
  isAiSpeaking = false,
}) => {
  const { t } = useTranslation();
  const capture = useSpeakingLiveCapture({
    maxDurationMs,
    deviceId,
    onAudioChunk,
    onRecordingStart,
    onRecordingStop,
  });

  const isRecording = capture.state === 'RECORDING';
  const isRequesting = capture.state === 'REQUESTING_PERMISSION';

  const handleTap = useCallback(() => {
    if (isRecording) {
      playSafely(playRecordStop);
      capture.stop();
      return;
    }
    if (isRequesting) {
      // Already mid-request — capture.stop() itself defers this correctly
      // (see useSpeakingLiveCapture's own H1 handling).
      capture.stop();
      return;
    }
    if (disabled) return;
    playSafely(playRecordStart);
    capture.start();
  }, [capture, disabled, isRecording, isRequesting]);

  if (capture.state === 'PERMISSION_DENIED' || capture.state === 'UNSUPPORTED') {
    return (
      <p className="text-sm font-medium text-rose-600 dark:text-rose-400 text-center">
        {recordingErrorMessage(t, capture.errorKind!)}
      </p>
    );
  }

  // RECORDING and REQUESTING_PERMISSION must stay clickable regardless of
  // `disabled` — that's what lets the deferred-stop tap above register at
  // all. Only starting a NEW take is gated by the parent's busy state.
  const htmlDisabled = disabled && !isRecording && !isRequesting;

  // Idle (neither recording nor the AI speaking) shows a quiet, static
  // dotted line instead of the waveform — an animated waveform with nothing
  // real to show read as noise. It switches to the real SpeakingVoiceWave
  // (live mic level while recording, the existing "honest indeterminate"
  // pulse while the AI replies) the moment there is something real to
  // represent.
  const showWave = isRecording || isAiSpeaking;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center justify-center gap-4 sm:gap-5">
        {showWave ? (
          <SpeakingVoiceWave
            recording={isRecording}
            aiSpeaking={isAiSpeaking}
            level={capture.inputLevel}
            side="left"
          />
        ) : (
          <div
            aria-hidden="true"
            className="hidden sm:block w-16 md:w-24 border-t-2 border-dotted border-violet-300 dark:border-violet-700/60"
          />
        )}

        {/* Halo ring + glow orb, one consistent colour regardless of state —
            only the breathing glow / expanding ring and the icon change; a
            colour swap between idle/recording would fight the glow instead
            of reading as "always listening, ready for you". */}
        <div className="relative rounded-full bg-violet-500/10 dark:bg-violet-400/10 p-3 ring-1 ring-violet-400/25 speaking-mic-breathe">
          <button
            type="button"
            onClick={handleTap}
            disabled={htmlDisabled}
            aria-pressed={isRecording}
            aria-label={isRecording ? t.practice.speakingTapToStop : t.practice.speakingTapToTalk}
            className="relative z-10 grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-blue-500 text-white shadow-[0_10px_30px_rgba(139,92,246,0.4)] transition duration-200 hover:scale-[1.04] active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-400/40 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 select-none"
          >
            {isRecording && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-[-10px] rounded-full border border-violet-400/40 speaking-mic-ring"
              />
            )}
            <span className="relative">
              {isRequesting ? (
                <Loader2 size={34} className="motion-safe:animate-spin" aria-hidden="true" />
              ) : isRecording ? (
                <Square size={30} aria-hidden="true" />
              ) : (
                <Mic size={34} aria-hidden="true" />
              )}
            </span>
          </button>
        </div>

        {showWave ? (
          <SpeakingVoiceWave
            recording={isRecording}
            aiSpeaking={isAiSpeaking}
            level={capture.inputLevel}
            side="right"
          />
        ) : (
          <div
            aria-hidden="true"
            className="hidden sm:block w-16 md:w-24 border-t-2 border-dotted border-blue-300 dark:border-blue-700/60"
          />
        )}
      </div>

      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
        {isRecording ? t.practice.speakingTapToStop : t.practice.speakingTapToTalk}
      </p>
      <p className="text-xs text-slate-400 dark:text-slate-500 -mt-1.5">
        {t.practice.speakingRecorderHint}
      </p>

      {capture.state === 'ERROR' && capture.errorKind && (
        <p className="text-xs font-medium text-rose-600 dark:text-rose-400 text-center max-w-xs">
          {recordingErrorMessage(t, capture.errorKind)}
        </p>
      )}
    </div>
  );
};

export default SpeakingRecorderControl;
