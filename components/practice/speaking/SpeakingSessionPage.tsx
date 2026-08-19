import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Volume2, Captions, RotateCcw, Square } from 'lucide-react';
import StudentLayout from '../../user/StudentLayout';
import BackButton from '../../shared/BackButton';
import ErrorState from '../../shared/ErrorState';
import Skeleton from '../../shared/Skeleton';
import { useTranslation } from '../../../i18n/useTranslation';
import {
  completeSpeakingAttempt,
  getSpeakingScenario,
  startSpeakingAttempt,
  SpeakingAttemptSummary,
  SpeakingExerciseStudentView,
} from '../../../services/speakingService';
import { connectSpeakingLive, SpeakingLiveSocketConnection } from '../../../services/speakingLiveSocket';
import { useSpeakingLivePlayback } from './useSpeakingLivePlayback';
import SpeakingRecorderControl from './SpeakingRecorderControl';
import ConversationTurnList, { ConversationTurn } from './ConversationTurnList';
import { useMicrophones } from '../listening/recording/useMicrophones';
import { authService } from '../../../services/authService';

// Speaking Partner — the functional core: /practice/speaking/:scenarioId/:exerciseId.
//
// THE CONVERSATION ENGINE IS GEMINI LIVE, over one persistent WebSocket
// (services/speakingLiveSocket.ts) held open for the whole session — not a
// discrete HTTP request per turn. Text and audio arrive independently:
// `onTurnFinalized` carries the finished transcript pair (safe point to
// append chat bubbles), while `onAudioChunk` streams the AI's voice in
// real time through useSpeakingLivePlayback — the two are driven by
// SEPARATE state, not one shared "turn in flight" boolean, because by the
// time a turn finalizes its audio may still be finishing playback (gapless
// scheduling plays ahead of the finalize signal).
//
// AI_SPEAKING IS DERIVED FROM playback.isSpeaking, not from "a turn hasn't
// finalized yet" — see the effect below. AI_PROCESSING is the honest gap
// between activityEnd and the first byte of Gemini's reply arriving
// (audio or otherwise) — there is still no way to distinguish "still
// listening" from "composing a reply" over this API either.
type SpeakingTurnState = 'IDLE' | 'RECORDING' | 'AI_PROCESSING' | 'AI_SPEAKING' | 'ERROR';

const MAX_RECORDING_MS = 60_000;

const SpeakingSessionPage: React.FC = () => {
  const { t, language } = useTranslation();
  const { scenarioId, exerciseId } = useParams<{ scenarioId: string; exerciseId: string }>();

  // Passive reuse of Shadowing's own device resolution (Sprint 11 Phase
  // 3.1) — NEVER calls requestAccess() here, no chooser UI on this page.
  // Its silent mount-time probe alone is enough to resolve an already-
  // granted permission + a stored `preferred-microphone` choice into a
  // validated deviceId (or leave `selected` null, falling back to
  // useSpeakingLiveCapture's own default-device behaviour — unchanged from
  // before this existed). Real bug this fixes: without a deviceId,
  // getUserMedia grabs the OS's own "default" input, which on some
  // machines is a silent virtual device ahead of the real microphone (see
  // useMicrophones.ts's own header) — confirmed live 2026-08-20 via
  // SpeakingLiveAudioDiagnostics reporting rms=0/peak=0 on every turn while
  // Shadowing, which already threads a resolved deviceId through, worked.
  const [userId] = useState(() => authService.getUser()?.id ?? '');
  const microphones = useMicrophones(userId);

  const [exercise, setExercise] = useState<SpeakingExerciseStudentView | null>(null);
  const [isFreeTalk, setIsFreeTalk] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [state, setState] = useState<SpeakingTurnState>('IDLE');
  const [turnError, setTurnError] = useState<string | null>(null);
  /** The WHOLE Live connection ended (not just one turn) — see this file's own header and docs/CLAUDE.md's "Known limitation". Distinct from a per-turn ERROR: this one never clears on its own. */
  const [liveEnded, setLiveEnded] = useState(false);
  const [summary, setSummary] = useState<SpeakingAttemptSummary | null>(null);
  const [completing, setCompleting] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(false);

  const turnCountRef = useRef(0);
  const autoStartTriggeredRef = useRef(false);
  const socketRef = useRef<SpeakingLiveSocketConnection | null>(null);
  const playback = useSpeakingLivePlayback();

  // The exercise's public fields are already known from the scenario read
  // (SpeakingExerciseStudentView) — no need to start an attempt just to
  // preview it. For a normal (non-Free-Talk) scenario, starting stays an
  // explicit gesture (Web Audio autoplay policy wants one before audio can
  // actually play). Free Talk is the one exception: the catalog's "Start
  // chatting" tap already IS that gesture, and SpeakingScenarioPage already
  // skips its own exercise-list step for it, so a second "Bắt đầu" tap here
  // would just be a redundant hop — see the auto-start effect below.
  useEffect(() => {
    if (!scenarioId || !exerciseId) return undefined;
    let cancelled = false;
    getSpeakingScenario(scenarioId)
      .then((detail) => {
        if (cancelled) return;
        const match = detail.exercises.find((e) => e.id === exerciseId);
        if (!match) {
          setLoadError(t.practice.speakingNoExercises);
          return;
        }
        setIsFreeTalk(detail.isFreeTalk);
        setExercise(match);
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t is stable enough for this one-shot load
  }, [scenarioId, exerciseId]);

  useEffect(
    () => () => {
      socketRef.current?.close();
      socketRef.current = null;
    },
    [],
  );

  // AI_SPEAKING tracks REAL playback, not "a turn is outstanding" — see this
  // file's own header. Never overrides ERROR (a turn-level failure stays
  // visible even if some trailing audio is still draining).
  useEffect(() => {
    if (playback.isSpeaking) {
      setState((prev) => (prev === 'ERROR' ? prev : 'AI_SPEAKING'));
    } else {
      setState((prev) => (prev === 'AI_SPEAKING' ? 'IDLE' : prev));
    }
  }, [playback.isSpeaking]);

  const handleStart = useCallback(async () => {
    if (!exerciseId) return;
    try {
      const attempt = await startSpeakingAttempt(exerciseId);
      setAttemptId(attempt.attemptId);
      turnCountRef.current = 0;
      setTurns([{ role: 'ai', text: attempt.openingLine, at: Date.now() }]);
      // The opening line's TEXT is authored, static DB content, shown
      // immediately — but its AUDIO now comes from Gemini Live itself
      // (SpeakingLiveSession cues Gemini to speak it verbatim as the very
      // first generated turn, see docs/CLAUDE.md's Speaking Live section),
      // not the browser's own TTS. That fixed a real product bug: the
      // greeting used to play in the OS's default SpeechSynthesis voice
      // while every later turn played in the Live session's own voice —
      // two audibly different "characters" in one conversation. `state`
      // starts AI_PROCESSING here (not IDLE) so the mic stays disabled
      // until the greeting's audio has actually finished playing — the
      // existing playback.isSpeaking effect below settles it to IDLE the
      // same way it already does after every real turn's reply.
      setState('AI_PROCESSING');

      socketRef.current = connectSpeakingLive(attempt.liveTicket, {
        onAudioChunk: (base64) => playback.handleAudioChunk(base64),
        onOpeningReady: () => {
          // Cache the greeting's audio at turn index 0, same convention
          // ConversationTurnList/handlePlayTurn already use for every real
          // AI turn — see the aiIndex comment below.
          playback.finalizeTurnAudio(0);
        },
        onTurnFinalized: (userText, aiText) => {
          turnCountRef.current += 1;
          // Index math: the opening line always occupies index 0, so the
          // Nth finalized turn's AI reply always lands at 2*N once its
          // user turn is pushed alongside it — verified against the exact
          // shape of the setTurns call below.
          const aiIndex = turnCountRef.current * 2;
          const now = Date.now();
          setTurns((prev) => [
            ...prev,
            { role: 'user', text: userText, at: now },
            { role: 'ai', text: aiText, at: now },
          ]);
          playback.finalizeTurnAudio(aiIndex);
          setTurnError(null);
        },
        onTurnEmpty: () => {
          playback.discardCurrentTurn();
          setState('IDLE');
        },
        onTurnError: () => {
          playback.discardCurrentTurn();
          setTurnError(t.practice.speakingLiveTurnError);
          setState('ERROR');
        },
        onInterrupted: () => {
          // Defensive only — manual activity control means Gemini should
          // never actually signal a barge-in, but if it ever does, any
          // scheduled audio stops rather than playing over whatever comes
          // next.
          playback.stopPlayback();
        },
        onSessionClosed: () => setLiveEnded(true),
        onConnectionLost: () => setLiveEnded(true),
      });
    } catch (err) {
      setLoadError((err as Error).message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- playback's functions are themselves stable (useCallback); t is stable enough for this one-shot start
  }, [exerciseId]);

  // Free Talk: skip the "Bắt đầu" screen entirely and drop straight into the
  // chat, guarded by a ref (not just `!attemptId`) so React 18's dev-mode
  // double-invoke of effects can never fire startSpeakingAttempt twice.
  useEffect(() => {
    if (!isFreeTalk || !exercise || autoStartTriggeredRef.current) return;
    autoStartTriggeredRef.current = true;
    handleStart();
  }, [isFreeTalk, exercise, handleStart]);

  const handleRecordingStart = useCallback(() => {
    socketRef.current?.startTurn();
    setState('RECORDING');
  }, []);

  const handleRecordingStop = useCallback(() => {
    socketRef.current?.endTurn();
    setState('AI_PROCESSING');
  }, []);

  const handleAudioChunk = useCallback((base64Pcm16: string) => {
    socketRef.current?.sendAudioChunk(base64Pcm16);
  }, []);

  const handleComplete = useCallback(async () => {
    if (!attemptId) return;
    setCompleting(true);
    try {
      const result = await completeSpeakingAttempt(attemptId);
      socketRef.current?.close();
      socketRef.current = null;
      playback.stopPlayback();
      setSummary(result);
    } catch (err) {
      setTurnError((err as Error).message);
    } finally {
      setCompleting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- playback.stopPlayback is stable (useCallback)
  }, [attemptId]);

  /** Replays turn `index`'s ORIGINAL Gemini Live audio from the per-turn cache — including index 0, the opening line, now that it is cued through Live too. No network/Gemini call. */
  const handlePlayTurn = useCallback(
    (index: number) => {
      playback.replay(index);
    },
    [playback],
  );

  const handleReplayLatestAi = useCallback(() => {
    for (let i = turns.length - 1; i >= 0; i -= 1) {
      if (turns[i].role === 'ai') {
        handlePlayTurn(i);
        return;
      }
    }
  }, [turns, handlePlayTurn]);

  // Guards the "Quay lại chọn chế độ" link back to /practice. Reuses the
  // exact same mid-turn condition already used to disable the Finish button
  // and the mic — no new semantics. Attached via onClickCapture (capture
  // phase runs before Link's own bubble-phase click handler, and Link bails
  // out of navigating once event.defaultPrevented is already true), so
  // BackButton itself needs no changes. A no-op on the summary screen: state
  // is guaranteed IDLE there, since Finish is only clickable from IDLE.
  const handleBackToHubClick = useCallback(
    (e: React.MouseEvent) => {
      const midTurn = state !== 'IDLE' && state !== 'ERROR';
      if (midTurn && !window.confirm(t.practice.speakingLeaveConfirm)) {
        e.preventDefault();
      }
    },
    [state, t],
  );

  if (loadError) {
    return (
      <StudentLayout>
        <div className="max-w-2xl mx-auto">
          <ErrorState message={loadError} />
        </div>
      </StudentLayout>
    );
  }

  if (!exercise) {
    return (
      <StudentLayout>
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-32" />
        </div>
      </StudentLayout>
    );
  }

  if (summary) {
    return (
      <StudentLayout>
        <div className="max-w-2xl mx-auto space-y-6 text-center">
          <div className="bg-white dark:bg-slate-900 rounded-[24px] shadow-lg dark:shadow-none dark:border dark:border-slate-800 p-10">
            <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
              {t.practice.speakingSummaryTitle}
            </h2>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">
              {t.practice.speakingSummaryTurns(summary.turnCount)}
            </p>
          </div>
          <div onClickCapture={handleBackToHubClick}>
            <BackButton to="/practice" label={t.practice.backToModeHub} />
          </div>
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div className="max-w-4xl mx-auto">
        {/* Session header — sits directly on the page background, no card:
            wrapping it in a bounded card read as one more disconnected
            block among several. Icon-only back control mirrors
            components/practice/vocab/SessionHeader.tsx's pattern (see
            BackButton.tsx's own header comment: "the icon-only buttons in
            the practice session headers... are different controls" than the
            page-level BackButton pill). Guarded by handleBackToHubClick
            while a turn is actually in flight, same as before.
            Language-aware (2026-08-20): title/description follow `language`
            together, not a fixed Vietnamese/English mix. */}
        <div onClickCapture={handleBackToHubClick} className="mb-6 flex items-start gap-4">
          <Link
            to="/practice"
            aria-label={t.practice.backToModeHub}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold text-slate-950 dark:text-slate-100 truncate">
                {language === 'vi' ? exercise.titleVi : exercise.title}
              </h1>
              <span className="shrink-0 rounded-md bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 text-sm font-semibold text-blue-600 dark:text-blue-400">
                {exercise.level}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {language === 'vi' ? exercise.descriptionVi : exercise.description}
            </p>
          </div>
        </div>

        {!attemptId ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            {isFreeTalk ? (
              <div className="flex flex-col items-center justify-center gap-3 py-10">
                <Loader2 size={20} className="motion-safe:animate-spin text-blue-500" aria-hidden="true" />
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                  {t.practice.speakingConnecting}
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleStart}
                className="w-full py-3.5 rounded-xl bg-blue-500 dark:bg-[#00A3FF] text-white font-bold text-sm shadow-lg hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                {t.practice.speakingStartAction}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Message area — no card, no border. Scrolls on its own once
                the conversation grows past a comfortable height, instead of
                the whole page. */}
            <div className="max-h-[55vh] overflow-y-auto space-y-4 pr-1">
              <ConversationTurnList turns={turns} showSubtitles={showSubtitles} onPlayTurn={handlePlayTurn} />
              {turnError && state === 'ERROR' && (
                <ErrorState message={turnError} onRetry={() => setState('IDLE')} />
              )}
            </div>

            {/* Voice controls — the ONE surface below the message area:
                status line, mic, hint text and the secondary action row all
                live together instead of being scattered blocks. */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              <div className="min-h-[20px] text-center mb-1">
                {state === 'AI_PROCESSING' && (
                  <p className="flex items-center justify-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400">
                    <Loader2 size={16} className="motion-safe:animate-spin" aria-hidden="true" />
                    {t.practice.speakingStateProcessing}
                  </p>
                )}
                {state === 'AI_SPEAKING' && (
                  <p className="flex items-center justify-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400">
                    <Volume2 size={16} aria-hidden="true" />
                    {t.practice.speakingStateSpeaking}
                  </p>
                )}
                {state === 'RECORDING' && (
                  <p className="text-sm font-bold text-violet-500 dark:text-violet-400">
                    {t.practice.speakingStateRecording}
                  </p>
                )}
              </div>

              {liveEnded ? (
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 text-center max-w-xs mx-auto py-4">
                  {t.practice.speakingLiveSessionEnded}
                </p>
              ) : (
                <SpeakingRecorderControl
                  onAudioChunk={handleAudioChunk}
                  onRecordingStart={handleRecordingStart}
                  onRecordingStop={handleRecordingStop}
                  disabled={state !== 'IDLE' && state !== 'ERROR'}
                  maxDurationMs={MAX_RECORDING_MS}
                  deviceId={microphones.selected?.deviceId ?? null}
                  isAiSpeaking={state === 'AI_SPEAKING'}
                />
              )}

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleReplayLatestAi}
                  disabled={turns.length === 0}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-sm font-medium text-slate-800 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <RotateCcw size={16} aria-hidden="true" />
                  {t.practice.speakingReplayAi}
                </button>

                <button
                  type="button"
                  onClick={() => setShowSubtitles((prev) => !prev)}
                  aria-pressed={showSubtitles}
                  className={`inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                    showSubtitles
                      ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/40 text-blue-600 dark:text-blue-400'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <Captions size={16} aria-hidden="true" />
                  {showSubtitles ? t.practice.speakingSubtitlesOn : t.practice.speakingSubtitlesOff}
                </button>

                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={(state !== 'IDLE' && !liveEnded) || completing}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-sm font-medium text-slate-800 dark:text-slate-200 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:hover:border-rose-500/40 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <Square size={16} aria-hidden="true" />
                  {t.practice.speakingCompleteAction}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </StudentLayout>
  );
};

export default SpeakingSessionPage;
