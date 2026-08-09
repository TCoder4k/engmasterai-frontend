import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Link,
  Navigate,
  Outlet,
  useLocation,
  useOutletContext,
  useParams,
} from 'react-router-dom';
import { Headphones } from 'lucide-react';
import StudentLayout from '../../user/StudentLayout';
import BackButton from '../../shared/BackButton';
import EmptyState from '../../shared/EmptyState';
import ErrorState from '../../shared/ErrorState';
import Skeleton from '../../shared/Skeleton';
import SoundToggle from '../../shared/SoundToggle';
import ListeningMediaPanel from './ListeningMediaPanel';
import SegmentListPanel from './SegmentListPanel';
import SegmentTransportBar from './SegmentTransportBar';
import { useSegmentPlayback, MediaController } from './useSegmentPlayback';
import { useStudyActivity } from '../../shared/StudyTimeBoundary';
import { useTranslation } from '../../../i18n/useTranslation';
import { ApiError } from '../../../services/apiError';
import { authService } from '../../../services/authService';
import { recordRecentActivity } from '../../../services/recentActivity';
import {
  getListeningContent,
  ListeningContentDetail,
  ListeningMode,
} from '../../../services/listeningService';

// Sprint 11 Phase 2 — /practice/listening/:contentId, the LAYOUT route.
//
// WHY A LAYOUT ROUTE AND NOT A QUERY PARAM. This component owns the media
// player and the selected sentence; the mode panels render through <Outlet/>.
// React Router keeps a layout mounted while only the child route changes, so
// switching Dictation -> Shadowing (Phase 4B) will not tear down and rebuild
// the YouTube iframe — the student keeps their position in the recording. A
// `?mode=` param on a self-contained page cannot promise that, because the
// page itself would re-render as the owner of the player.
//
// THE ID IS A UUID. Listening introduced no slug, so these routes look like
// every other id-bearing route in the app and the backend parses them with
// ParseUUIDPipe.
//
// ONE 404 FOR EVERYTHING. Missing id, draft recording, draft category and
// unsupported mode all render the same not-found surface. The first three are
// indistinguishable already (the server answers identically on purpose); the
// fourth is enforced here, because "this recording exists but has no
// shadowing" is still a fact about a recording.

interface ListeningContentContextValue {
  content: ListeningContentDetail;
  currentIndex: number;
  goToSegment: (index: number) => void;
  /** Provider-truthful: reflects the player, so a blocked play never reads as playing. */
  isPlaying: boolean;
  togglePlay: () => void;
  replaySegment: () => void;
  /**
   * Stop the recording's audio outright.
   *
   * Sprint 11 Phase 3 needs a one-way pause, not a toggle: Shadowing silences
   * the player before opening the microphone, and `togglePlay` would have
   * STARTED playback in the (common) case where the student had already paused
   * it themselves.
   */
  pauseMedia: () => void;
  /** False whenever the media cannot be driven — a broken video must not block practice. */
  mediaAvailable: boolean;
  /**
   * Sprint 11 Phase 4C — the SAME loop/rate state `SegmentTransportBar` already
   * drives, exposed here so Shadowing's own "listen and repeat" control acts on
   * the real segment player instead of standing up a second, decorative one.
   * One controller, two surfaces — never two sources of truth for what the
   * media is doing.
   */
  loop: boolean;
  setLoop: (loop: boolean) => void;
  playbackRate: number;
  availableRates: number[];
  setPlaybackRate: (rate: number) => void;
  solvedSegmentIds: Set<string>;
  setSolvedSegmentIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  assistedSegmentIds: Set<string>;
  setAssistedSegmentIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  /**
   * Sprint 11 Phase 3.4 — Shadowing's OWN completed set, separate from
   * Dictation's `solvedSegmentIds`. The two modes grade the same segment ids
   * independently; sharing one Set would mark a segment done in Shadowing
   * just because Dictation solved it, or vice versa.
   */
  shadowingCompletedSegmentIds: Set<string>;
  setShadowingCompletedSegmentIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  /**
   * Move to a sentence AND play it — what Next means in both modes. Distinct
   * from `goToSegment` (select only), which the sentence list still uses for
   * some flows (e.g. replaying mistakes) where audio would interrupt.
   */
  goToSegmentAndPlay: (index: number) => void;
  /** Lets a mode panel stop study-time accrual once its session is over. */
  setStudyActive: (active: boolean) => void;
}

export const useListeningContent = (): ListeningContentContextValue =>
  useOutletContext<ListeningContentContextValue>();

/** URL segment -> mode. Unknown segments return null and are treated as not-found. */
const MODE_BY_PATH: Record<string, ListeningMode> = {
  dictation: 'DICTATION',
  shadowing: 'SHADOWING',
};

export const PATH_BY_MODE: Record<ListeningMode, string> = {
  DICTATION: 'dictation',
  SHADOWING: 'shadowing',
};

// Fixed preference order for the index redirect. DICTATION first because it is
// the implemented mode; a recording that enables only SHADOWING still redirects
// there and gets an honest "not available yet" panel rather than a dead page.
const MODE_PRIORITY: ListeningMode[] = ['DICTATION', 'SHADOWING'];

const ListeningContentPage: React.FC = () => {
  const { t } = useTranslation();
  const { contentId } = useParams<{ contentId: string }>();
  const location = useLocation();

  const [content, setContent] = useState<ListeningContentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  // `notFound` is tracked apart from `error` so a 404 renders the safe
  // not-found surface while a 500 or an offline backend renders a retryable
  // error. Collapsing them would tell a student "this lesson does not exist"
  // every time the server hiccuped.
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [solvedSegmentIds, setSolvedSegmentIds] = useState<Set<string>>(new Set());
  const [assistedSegmentIds, setAssistedSegmentIds] = useState<Set<string>>(new Set());
  const [shadowingCompletedSegmentIds, setShadowingCompletedSegmentIds] = useState<
    Set<string>
  >(new Set());
  const [studyActive, setStudyActive] = useState(true);
  // Lives here rather than in a mode panel because it controls the sentence
  // list, which this layout owns and every mode shares.
  const [hideTranslation, setHideTranslation] = useState(false);

  const [controller, setController] = useState<MediaController | null>(null);
  const [mediaPlaying, setMediaPlaying] = useState(false);
  const [availableRates, setAvailableRates] = useState<number[]>([1]);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loop, setLoop] = useState(false);

  const loadContent = useCallback(async () => {
    if (!contentId) return;
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const data = await getListeningContent(contentId);
      setContent(data);

      // Sprint 11 Phase 4A — rehydrate from the SERVER, which is what makes a
      // refresh mid-exercise lossless. Before this, progress lived only in
      // component state and a reload started the recording over.
      //
      // Only sentences the student has attempted have a row, so absence is
      // "not started" and needs no placeholder.
      const rows = data.dictationProgress?.segments ?? [];
      setSolvedSegmentIds(
        new Set(rows.filter((row) => row.completedAt).map((row) => row.segmentId)),
      );
      setAssistedSegmentIds(
        new Set(rows.filter((row) => row.assisted).map((row) => row.segmentId)),
      );

      // Shadowing's own progress, seeded the same way — `completedAt` is only
      // ever set server-side once an attempt passed (shadowing.service.ts),
      // never for a merely-attempted-but-failed segment.
      const shadowingRows = data.shadowingProgress ?? [];
      setShadowingCompletedSegmentIds(
        new Set(shadowingRows.filter((row) => row.completedAt).map((row) => row.segmentId)),
      );

      // Land on the first unfinished sentence rather than always on the first
      // one. "Progress is not lost" has to mean the student resumes where the
      // work actually is, not merely that a tick mark survived.
      const solvedIds = new Set(
        rows.filter((row) => row.completedAt).map((row) => row.segmentId),
      );
      const resumeAt = data.segments.findIndex(
        (segment) => !solvedIds.has(segment.id),
      );
      setCurrentIndex(resumeAt === -1 ? 0 : resumeAt);
    } catch (caught) {
      setContent(null);
      if (caught instanceof ApiError && caught.status === 404) {
        setNotFound(true);
      } else {
        setError(
          caught instanceof Error ? caught.message : t.practice.listeningLoadError,
        );
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentId]);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  // Navigating between recordings reuses this component, so every piece of
  // per-recording state is reset explicitly.
  //
  // IT SKIPS THE FIRST RUN, so it resets on an actual change of recording and
  // never on mount. Child effects commit before parent effects, so an
  // unconditional version would race the media panel's controller publication:
  // harmless today, because both providers publish asynchronously and land in a
  // later commit, but the whole point of this effect is "the recording
  // changed", and mount is not that.
  const previousContentIdRef = useRef(contentId);
  useEffect(() => {
    if (previousContentIdRef.current === contentId) return;
    previousContentIdRef.current = contentId;
    setCurrentIndex(0);
    setSolvedSegmentIds(new Set());
    setAssistedSegmentIds(new Set());
    setShadowingCompletedSegmentIds(new Set());
    setStudyActive(true);
    setController(null);
    setMediaPlaying(false);
    setLoop(false);
    setPlaybackRate(1);
  }, [contentId]);

  const segments = content?.segments ?? [];
  const currentSegment = segments[currentIndex] ?? null;

  const { isPlaying, playSegment, replaySegment, pause } = useSegmentPlayback({
    controller,
    segment: currentSegment,
    loop,
  });

  // Ask the provider what it can actually do, the moment it is ready.
  useEffect(() => {
    if (!controller) {
      setAvailableRates([1]);
      return;
    }
    const rates = controller.getAvailablePlaybackRates();
    setAvailableRates(rates.length > 0 ? rates : [1]);
  }, [controller]);

  const handlePlaybackRateChange = useCallback(
    (rate: number) => {
      setPlaybackRate(rate);
      controller?.setPlaybackRate(rate);
    },
    [controller],
  );

  // Move to a sentence WITHOUT playing — used by Dictation's own Next control,
  // where the student is typing and unsolicited audio would interrupt them.
  const goToSegment = useCallback(
    (index: number) => {
      if (index < 0 || index >= segments.length) return;
      setCurrentIndex(index);
    },
    [segments.length],
  );

  // Move to a sentence AND play it — what clicking a row in the list means.
  //
  // The earlier version only selected, on the reasoning that playback must
  // follow a user gesture. That rule was applied too broadly: clicking a
  // sentence IS the gesture. The rule exists to stop audio starting on mount
  // or on navigation, neither of which is happening here, and every autoplay
  // policy (iOS Safari included) accepts a play() call made in a click
  // handler. Selecting a sentence and then having to press Play was simply a
  // second click for something the first one already asked for.
  //
  // A COUNTER, NOT A BOOLEAN, so clicking the sentence you are already on
  // replays it: the index does not change, but the token does.
  const [playRequest, setPlayRequest] = useState(0);
  const selectAndPlaySegment = useCallback(
    (index: number) => {
      if (index < 0 || index >= segments.length) return;
      setCurrentIndex(index);
      setPlayRequest((token) => token + 1);
    },
    [segments.length],
  );

  // Playback has to wait for the commit that applies the new index, because
  // useSegmentPlayback reads the CURRENT sentence — calling play() straight
  // after setCurrentIndex would replay the previous one, and the hook's own
  // segment-change effect would then stop it. That effect is registered by the
  // hook call above, so it runs before this one and cannot undo it.
  const lastPlayRequestRef = useRef(0);
  useEffect(() => {
    if (playRequest === lastPlayRequestRef.current) return;
    lastPlayRequestRef.current = playRequest;
    playSegment();
  }, [playRequest, currentIndex, playSegment]);

  // Sprint 10.5 study time. `activityId` is now the content UUID rather than
  // the old seed slug, which the heartbeat DTO already accepts (a bounded
  // string, deliberately not @IsUUID — it also carries deck ids).
  //
  // `mediaPlaying` is the PROVIDER's state, not this app's intent to play: it
  // comes from YouTube's onStateChange / the audio element's play+pause
  // events. A failed or blocked play therefore never credits study time.
  useStudyActivity({
    type: 'LISTENING',
    activityId: contentId,
    active: Boolean(content) && studyActive,
    mediaPlaying,
  });

  // Sprint 11 Phase 4A — put this recording into the Continue Learning ring
  // buffer, which no Listening surface had ever done. The LISTENING branch of
  // ContinueLearningCard has existed since Sprint 05 and could never fire,
  // because nothing wrote an entry for it to find.
  //
  // The path is resolved HERE, where the id is in scope, and stored whole —
  // the buffer never re-derives a route from a bare id.
  useEffect(() => {
    if (!content || !contentId) return;
    const user = authService.getUser();
    if (!user) return;
    recordRecentActivity(user.id, {
      type: 'practice',
      id: contentId,
      title: content.title,
      path: `/practice/listening/${contentId}`,
      courseType: 'LISTENING',
    });
  }, [content, contentId]);

  const currentMode = useMemo<ListeningMode | null>(() => {
    const tail = location.pathname.split('/').filter(Boolean).pop();
    return (tail && MODE_BY_PATH[tail]) || null;
  }, [location.pathname]);

  const backLink = (
    <BackButton to="/practice/listening" label={t.practice.backToListening} />
  );

  if (loading) {
    return (
      <StudentLayout>
        <div className="max-w-6xl mx-auto space-y-5">
          {backLink}
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </StudentLayout>
    );
  }

  if (error) {
    return (
      <StudentLayout>
        <div className="max-w-3xl mx-auto space-y-4">
          {backLink}
          <ErrorState message={error} onRetry={() => void loadContent()} />
        </div>
      </StudentLayout>
    );
  }

  if (notFound || !content) {
    return (
      <StudentLayout>
        <div className="max-w-3xl mx-auto space-y-4">
          {backLink}
          <EmptyState icon={<Headphones size={32} />} message={t.practice.lessonNotFound} />
        </div>
      </StudentLayout>
    );
  }

  // Index route: send the student to the first mode this recording enables.
  // `replace` so Back returns to the catalog rather than bouncing through the
  // redirect again.
  if (!currentMode) {
    const firstMode =
      MODE_PRIORITY.find((mode) => content.supportedModes.includes(mode)) ?? null;
    if (!firstMode) {
      return (
        <StudentLayout>
          <div className="max-w-3xl mx-auto space-y-4">
            {backLink}
            <EmptyState
              icon={<Headphones size={32} />}
              message={t.practice.listeningNoModeAvailable}
            />
          </div>
        </StudentLayout>
      );
    }
    return <Navigate to={PATH_BY_MODE[firstMode]} replace />;
  }

  // A mode the recording does not enable is not a redirect — it is a 404. A
  // redirect would confirm the recording exists and quietly hand the student a
  // different exercise than the one their link asked for.
  if (!content.supportedModes.includes(currentMode)) {
    return (
      <StudentLayout>
        <div className="max-w-3xl mx-auto space-y-4">
          {backLink}
          <EmptyState icon={<Headphones size={32} />} message={t.practice.lessonNotFound} />
        </div>
      </StudentLayout>
    );
  }

  const contextValue: ListeningContentContextValue = {
    content,
    currentIndex,
    goToSegment,
    isPlaying,
    togglePlay: () => (isPlaying ? pause() : playSegment()),
    replaySegment,
    pauseMedia: pause,
    mediaAvailable: controller !== null,
    loop,
    setLoop,
    playbackRate,
    availableRates,
    setPlaybackRate: handlePlaybackRateChange,
    solvedSegmentIds,
    setSolvedSegmentIds,
    assistedSegmentIds,
    setAssistedSegmentIds,
    shadowingCompletedSegmentIds,
    setShadowingCompletedSegmentIds,
    goToSegmentAndPlay: selectAndPlaySegment,
    setStudyActive,
  };

  const modeTab = (mode: ListeningMode, label: string) => {
    const enabled = content.supportedModes.includes(mode);
    const active = currentMode === mode;
    if (!enabled) return null;
    return (
      <Link
        key={mode}
        to={PATH_BY_MODE[mode]}
        replace
        role="tab"
        aria-selected={active}
        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
          active
            ? 'bg-blue-500 text-white shadow'
            : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <StudentLayout>
      <div className="max-w-6xl mx-auto space-y-5">
        {backLink}

        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-black rounded-md uppercase">
                {content.level}
              </span>
              <h1 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 truncate">
                {content.title}
              </h1>
            </div>
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-1">
              {content.category.name}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Real navigation, not a state toggle — each mode has its own URL,
                so a refresh and a shared link both land on the same exercise. */}
            <div role="tablist" aria-label={t.practice.listeningModeTablist} className="flex gap-1.5">
              {modeTab('DICTATION', t.practice.listeningModeDictation)}
              {modeTab('SHADOWING', t.practice.listeningModeShadowing)}
            </div>
            <label
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer text-xs font-semibold transition-colors focus-within:ring-2 focus-within:ring-blue-400 ${
                hideTranslation
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <input
                type="checkbox"
                checked={hideTranslation}
                onChange={(event) => setHideTranslation(event.target.checked)}
                className="accent-blue-500 w-4 h-4"
              />
              <span>{t.practice.listeningHideTranslation}</span>
            </label>
            <SoundToggle />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm p-5 space-y-4">
              <ListeningMediaPanel
                content={content}
                onControllerChange={setController}
                onPlayingChange={setMediaPlaying}
              />
              <SegmentTransportBar
                isPlaying={isPlaying}
                disabled={!controller || !currentSegment}
                loop={loop}
                onLoopChange={setLoop}
                playbackRate={playbackRate}
                availableRates={availableRates}
                onPlaybackRateChange={handlePlaybackRateChange}
                onPlayPause={() => (isPlaying ? pause() : playSegment())}
                onReplay={replaySegment}
              />
            </div>

            <Outlet context={contextValue} />
          </div>

          <div>
            <SegmentListPanel
              segments={segments}
              currentIndex={currentIndex}
              revealedSegmentIds={
                currentMode === 'SHADOWING' ? shadowingCompletedSegmentIds : solvedSegmentIds
              }
              assistedSegmentIds={assistedSegmentIds}
              // Dictation is the only mode that must hide the sentence: it IS
              // the answer. Shadowing shows it, because reading it aloud is the
              // exercise.
              maskUnrevealed={currentMode === 'DICTATION'}
              hideTranslation={hideTranslation}
              isPlaying={mediaPlaying}
              onSelectSegment={selectAndPlaySegment}
            />
          </div>
        </div>
      </div>
    </StudentLayout>
  );
};

export default ListeningContentPage;
