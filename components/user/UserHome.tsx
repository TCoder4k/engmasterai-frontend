import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, Compass, Sparkles, Target } from 'lucide-react';
import StudentLayout from './StudentLayout';
import { EmailVerificationBanner } from '../auth/EmailVerificationBanner';
import ReviewDueCard from './ReviewDueCard';
import ContinueLearningCard from './ContinueLearningCard';
import RoadmapCard from './RoadmapCard';
import DashboardStatCards from './DashboardStatCards';
import LearningTrackCard from './LearningTrackCard';
import UserSidebar from './UserSidebar';
import CourseCard from './CourseCard';
import { authService } from '../../services/authService';
import { getPublishedCourses } from '../../services/courseService';
import { getLibrariesProgress } from '../../services/learningService';
import {
  continuePath,
  CourseProgressSummary,
  getCourseProgressSummaries,
} from '../../services/courseProgressService';
import {
  DashboardAnalytics,
  getDashboardAnalytics,
} from '../../services/analyticsService';
import { getPlacementRoadmap } from '../../services/placementService';
import { getMostRecentActivityOfType } from '../../services/recentActivity';
import {
  getListeningCatalog,
  getListeningProgress,
} from '../../services/listeningService';
import { handleAuthError } from '../../services/apiError';
import { Course, CourseType } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';

const TRACK_TYPES: CourseType[] = ['GRAMMAR', 'VOCABULARY', 'LISTENING'];

// A Grammar lesson deep link is `/courses/:courseId/lessons/:lessonId`, and
// the recent-activity ring buffer stores that already-resolved path. Pulling
// the course id back out of it is what lets Continue Learning show a REAL
// completion percentage without a new API or a new stored field.
const courseIdFromPath = (path: string): string | null =>
  /^\/courses\/([^/]+)\/lessons\//.exec(path)?.[1] ?? null;

// Sprint 05 rebalanced this page around the three learning modules:
//
//   welcome -> due review -> continue learning -> modules -> recommended
//
// Restyled to `ai-studio-dashboard-reference`'s DashboardView: section
// headers carry their reference icons (Play / Compass / Sparkles), the
// Continue Learning banner is a gradient card with a progress bar, and each
// Learning Track shows how big it is.
//
// Every count on this page is real and comes from an API the corresponding
// page already uses — Grammar lessons from GET /courses, Vocabulary decks
// from the libraries-progress call this page already makes for the review
// card, and Listening from the seeded catalogue.
//
// Sprint 09 added the fourth request, GET /analytics/dashboard, which made two
// of the four right-rail widgets real (today's counts and the seven-day
// activity streak). Daily Goal and Achievements remain sample data, as do the
// course star ratings — see components/user/dashboardContent.ts.
//
// The four requests are deliberately independent except for one: course
// progress must wait for the course list, because it is keyed by course id.
// Analytics does not, so it starts on mount rather than behind that waterfall.
const UserHome: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = authService.getUser();

  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  // null = not known (still loading, or the request failed). Every consumer
  // treats that as "say nothing", never as zero.
  const [dueTotal, setDueTotal] = useState<number | null>(null);
  // The other half of the review queue. `dueTotal` counts words already learned
  // and now due; the session is topped up with new words on top of that, which
  // is why the card used to say 23 and the session 38.
  const [newTotal, setNewTotal] = useState<number | null>(null);
  const [deckCount, setDeckCount] = useState<number | null>(null);
  // Tertiary stat folded into ReviewDueCard — same libraries-progress request
  // as above, so no extra fetch. `masteredPercent` stays null (not 0%) when
  // totalWords is 0: "no library" and "library with nothing mastered yet" are
  // different states, and only the second is a real 0%.
  const [masteredWords, setMasteredWords] = useState<number | null>(null);
  const [masteredPercent, setMasteredPercent] = useState<number | null>(null);
  // Null until the catalog answers, and null forever if it fails — never 0.
  const [listeningTotal, setListeningTotal] = useState<number | null>(null);
  // Sprint 11 Phase 4A. Null means "no honest figure" — never rendered as 0.
  const [listeningDetail, setListeningDetail] = useState<string | null>(null);
  // Sprint 08 — server-derived progress for every course on this page. `null`
  // until the one batch request resolves, so cards show no status rather than
  // an invented one.
  const [progressByCourse, setProgressByCourse] = useState<Map<
    string,
    CourseProgressSummary
  > | null>(null);

  // Dashboard redesign — the "X% lộ trình" subtitle needs to know WHICH
  // course ids belong to the roadmap specifically (progressByCourse above
  // already covers every published course, not just roadmap ones). A second,
  // independent GET /placement/roadmap alongside RoadmapCard's own — cheap,
  // and keeps RoadmapCard's documented self-containment intact rather than
  // lifting its fetch up into this component. Stays null (no subtitle
  // shown) on 404 (no roadmap yet) or any other failure — same silent-degrade
  // convention as ReviewDueCard/ContinueLearningCard's own supplementary
  // fetches.
  const [roadmapCourseIds, setRoadmapCourseIds] = useState<string[] | null>(null);

  // Sprint 09 — the right-rail stat widgets. THREE states, deliberately:
  // `undefined` while in flight, `null` when the request failed, a payload when
  // it succeeded. UserSidebar renders a skeleton, an error with a retry, or the
  // numbers — never a zero standing in for a failure, which on a student who
  // studied all morning is a false statement rather than an empty state.
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null | undefined>(
    undefined,
  );
  // Bumped by the widget's retry button to re-run the effect below.
  const [analyticsAttempt, setAnalyticsAttempt] = useState(0);

  useEffect(() => {
    getPublishedCourses()
      .then((res) => setCourses(res.data))
      .catch((err) => setCoursesError(handleAuthError(err, navigate) || t.common.loadFailed));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetched once here and passed down, so the review card, Continue Learning
  // and the Vocabulary track share a single request rather than each issuing
  // their own. Supplementary: a failure leaves all three silent instead of
  // breaking the page.
  useEffect(() => {
    let cancelled = false;
    getLibrariesProgress()
      .then((res) => {
        if (cancelled) return;
        setDueTotal(res.data.reduce((sum, library) => sum + library.dueWords, 0));
        setNewTotal(res.dailyNewWords.availableNow);
        setDeckCount(res.data.reduce((sum, library) => sum + library.deckCount, 0));
        const mastered = res.data.reduce((sum, library) => sum + library.masteredWords, 0);
        const totalWords = res.data.reduce((sum, library) => sum + library.totalWords, 0);
        setMasteredWords(mastered);
        setMasteredPercent(totalWords > 0 ? Math.round((mastered / totalWords) * 100) : null);
      })
      .catch(() => {
        // Intentionally silent — see the comment above.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sprint 11 Phase 2 — the REAL number of listening recordings this student
  // can open.
  //
  // This used to be `getLessonSummaries().length`, i.e. the length of a
  // hardcoded seed array, which was already wrong and would have become
  // conspicuously wrong: the dashboard would advertise five recordings while
  // the catalog it links to showed only the published ones. `limit: 1` because
  // only `meta.total` is wanted — the cards themselves are never rendered here.
  //
  // Failure leaves it null, and LearningTrackCard renders no count at all for
  // null. A zero would be a claim ("there is nothing to listen to") that a
  // failed request cannot support.
  useEffect(() => {
    let cancelled = false;
    getListeningCatalog({ limit: 1 })
      .then((res) => {
        if (!cancelled) setListeningTotal(res.meta.total);
      })
      .catch(() => {
        // Stays null — no honest number, so none is shown.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sprint 08 — ONE request covering every course on the page.
  //
  // This replaced a lookup that started from the recent-activity ring buffer:
  // if THIS browser had no entry, no course id could be resolved, no request
  // was made, and the dashboard showed no progress whatsoever — on an account
  // that might be 80% through a course. Progress now comes from the courses
  // the page already fetched, so a fresh browser shows the same numbers as an
  // old one.
  useEffect(() => {
    if (courses.length === 0 || !user) return;
    let cancelled = false;
    getCourseProgressSummaries(courses.map((course) => course.id))
      .then((map) => {
        if (!cancelled) setProgressByCourse(map);
      })
      .catch(() => {
        // Stays null: no honest numbers, so none are shown.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses, user?.id]);

  // Independent of everything else on this page — fires on mount, feeds only
  // the stat row's "X% lộ trình" subtitle (see roadmapCourseIds' own comment
  // above for why this is a second roadmap fetch rather than sharing
  // RoadmapCard's).
  useEffect(() => {
    let cancelled = false;
    getPlacementRoadmap()
      .then((view) => {
        if (!cancelled) {
          // Course-specific — VocabLibrary/ListeningCategory roadmap items
          // have no entry in progressByCourse (a Course-only map) to cross-
          // reference against.
          setRoadmapCourseIds(
            view.items
              .filter((item) => item.resourceType === 'COURSE')
              .map((item) => item.resourceId),
          );
        }
      })
      .catch(() => {
        // Stays null — no roadmap yet, or this supplementary fetch failed;
        // either way the subtitle is simply omitted.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Independent of the courses request, so it starts immediately rather than
  // waiting behind the courses -> progress waterfall beside it.
  useEffect(() => {
    let cancelled = false;
    setAnalytics(undefined);
    getDashboardAnalytics()
      .then((data) => {
        if (!cancelled) setAnalytics(data);
      })
      .catch(() => {
        // null, never a zeroed payload — see the state declaration above.
        if (!cancelled) setAnalytics(null);
      });
    return () => {
      cancelled = true;
    };
  }, [analyticsAttempt]);

  // Which Grammar course Continue Learning features, and where it points.
  //
  // Recent activity gets first say — "the course you were just in" is a good
  // answer and costs nothing. But it is only a HINT now: with no ring buffer,
  // the first course the server reports as in progress is used instead, and
  // the destination lesson always comes from the server's continuation rule
  // rather than from the last page this device happened to open.
  const featuredGrammar = useMemo(() => {
    if (!user || !progressByCourse) return null;

    const recent = getMostRecentActivityOfType(user.id, 'GRAMMAR');
    const recentCourseId = recent ? courseIdFromPath(recent.path) : null;
    const fromRecent = recentCourseId
      ? progressByCourse.get(recentCourseId)
      : undefined;
    if (fromRecent) return { summary: fromRecent, fromRecentActivity: true };

    const grammarIds = new Set(
      courses.filter((course) => course.type === 'GRAMMAR').map((c) => c.id),
    );
    const inProgress = [...progressByCourse.values()].find(
      (summary) =>
        grammarIds.has(summary.courseId) && summary.status === 'IN_PROGRESS',
    );
    return inProgress ? { summary: inProgress, fromRecentActivity: false } : null;
  }, [user, progressByCourse, courses]);

  const featuredTitle = featuredGrammar
    ? (courses.find((c) => c.id === featuredGrammar.summary.courseId)?.title ??
      null)
    : null;

  // Dashboard redesign — the stat row's "Tổng bài hoàn thành" number. Summed
  // across EVERY course on this page, not just roadmap ones — broader and
  // more representative of the student's whole learning journey than the
  // roadmap-scoped percentage beside it.
  const totalCompletedLessons = useMemo(
    () =>
      progressByCourse
        ? [...progressByCourse.values()].reduce(
            (sum, summary) => sum + summary.completedLessons,
            0,
          )
        : null,
    [progressByCourse],
  );

  // The stat row's "X% lộ trình" subtitle — deliberately roadmap-scoped
  // (unlike totalCompletedLessons above), filtering the SAME already-fetched
  // progressByCourse map down to just the roadmap's own course ids rather
  // than issuing a second progress-summary request.
  const roadmapCompletionPercent = useMemo(() => {
    if (!roadmapCourseIds || roadmapCourseIds.length === 0 || !progressByCourse) {
      return null;
    }
    let totalLessons = 0;
    let completedLessons = 0;
    for (const courseId of roadmapCourseIds) {
      const summary = progressByCourse.get(courseId);
      if (!summary) continue;
      totalLessons += summary.totalLessons;
      completedLessons += summary.completedLessons;
    }
    return totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : null;
  }, [roadmapCourseIds, progressByCourse]);

  const trackCounts: Record<CourseType, number | null> = useMemo(
    () => ({
      GRAMMAR: courses
        .filter((course) => course.type === 'GRAMMAR')
        .reduce((sum, course) => sum + (course._count?.lessons ?? 0), 0),
      VOCABULARY: deckCount,
      LISTENING: listeningTotal,
    }),
    [courses, deckCount, listeningTotal],
  );

  const firstName = user?.name?.split(' ').pop() || 'Learner';

  return (
    <StudentLayout>
      <EmailVerificationBanner />
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-6 lg:items-start max-w-[1400px]">
        {/* ---- Content ---- */}
        <div className="flex-1 min-w-0 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-6">
              {/* Phone-only: heading/subtitle shrunk (text-2xl/text-xs ->
                  text-lg/text-[11px]) to make room for the bigger mascot
                  next to it — sm:+ sizes unchanged (desktop untouched). */}
              <div className="space-y-1 min-w-0">
                <h1 className="text-lg sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {t.dashboard.welcomeBack}, {firstName}! 👋
                </h1>
                <p className="text-[11px] sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                  {t.dashboard.keepLearning}
                </p>
              </div>
              {/* mascot2-transparent.png — same Engy-at-a-laptop artwork
                  already approved for this exact header slot in the
                  onboarding wizard's RoadmapStep, background removed AND its
                  two baked-in decorative icon glyphs erased (they read as
                  flat illustration, not the crisp elevated UI chips the
                  mockup calls for) so the two badges below can be real DOM
                  chips instead. Reserved box sized from the asset's own real
                  730x342 aspect ratio, so there is no layout shift whether
                  the image is cached or still loading. object-contain
                  (never cover) keeps its natural proportions exactly as
                  authored. Now visible on phones too (previously hidden
                  below sm) — sized up a little from the heading/subtitle
                  shrink above so it reads clearly at phone width; sm:/md:
                  sizes unchanged (desktop untouched). */}
              <div className="relative flex-shrink-0 w-28 sm:w-48 md:w-56 max-w-full">
                <div className="w-full overflow-hidden" style={{ aspectRatio: '730 / 342' }}>
                  <img
                    src="/mascot/mascot2-transparent.png"
                    alt=""
                    aria-hidden="true"
                    className="w-full h-full object-contain select-none pointer-events-none"
                  />
                </div>

                {/* Floating stat-chip badges — real elevated UI, matching the
                    mockup's two white icon cards above the illustration.
                    Scaled down at the base tier to stay proportional to the
                    smaller phone-width mascot. */}
                <div
                  className="absolute -top-1 left-1 sm:left-4 w-5 h-5 sm:w-10 sm:h-10 rounded-lg sm:rounded-2xl bg-white dark:bg-ink-800 shadow-lg shadow-slate-300/60 dark:shadow-black/40 ring-1 ring-slate-100 dark:ring-ink-700 flex items-center justify-center"
                  aria-hidden="true"
                >
                  <BarChart3 className="w-2.5 h-2.5 sm:w-[18px] sm:h-[18px] text-blue-500" />
                </div>
                <Sparkles
                  className="absolute -top-1 left-0 w-2 h-2 sm:w-3 sm:h-3 text-blue-300 dark:text-blue-400/60"
                  aria-hidden="true"
                />

                <div
                  className="absolute -top-1 right-1 sm:right-4 w-5 h-5 sm:w-10 sm:h-10 rounded-lg sm:rounded-2xl bg-white dark:bg-ink-800 shadow-lg shadow-slate-300/60 dark:shadow-black/40 ring-1 ring-slate-100 dark:ring-ink-700 flex items-center justify-center"
                  aria-hidden="true"
                >
                  <Target className="w-2.5 h-2.5 sm:w-[18px] sm:h-[18px] text-teal-500" />
                </div>
                <Sparkles
                  className="absolute top-2 right-0 w-1.5 h-1.5 sm:w-2.5 sm:h-2.5 text-teal-300 dark:text-teal-400/60"
                  aria-hidden="true"
                />
              </div>
            </div>

            {/* First actionable thing on the page — one click to reviewing.
                Vocabulary mastery rides along as a compact tertiary stat
                inside this same card rather than a separate row. */}
            <ReviewDueCard
              dueTotal={dueTotal}
              newTotal={newTotal}
              masteredWords={masteredWords}
              masteredPercent={masteredPercent}
            />
          </div>

          <DashboardStatCards
            masteredWords={masteredWords}
            analytics={analytics}
            totalCompletedLessons={totalCompletedLessons}
            roadmapCompletionPercent={roadmapCompletionPercent}
          />

          <ContinueLearningCard
            dueTotal={dueTotal}
            listeningDetail={listeningDetail}
            progressPercent={featuredGrammar?.summary.progressPercent ?? null}
            grammarContinuePath={
              featuredGrammar ? continuePath(featuredGrammar.summary) : null
            }
            // Only needed when recent activity did NOT name the course — the
            // card already has a title in that case.
            grammarFallbackTitle={
              featuredGrammar && !featuredGrammar.fromRecentActivity
                ? featuredTitle
                : null
            }
          />

          {/* Personalized Onboarding & Placement Test, Phase 7 — the
              deterministic roadmap + optional AI narrative, and the retake
              entry point (both live in this one card). Self-contained: it
              issues its own GET /placement/roadmap, nothing else on this
              page shares that data. Its own empty state ("no roadmap yet")
              is one branch of this same component, so placing it here also
              puts that prompt after Continue Learning rather than before.
              id anchors ContinueLearningCard's "Xem lộ trình" link — the
              roadmap is multi-pillar now, not just Grammar, so that link
              scrolls here instead of navigating to /grammar. */}
          <div id="personal-roadmap">
            <RoadmapCard />
          </div>

          {/* Learning Tracks — the three module entry points. Horizontal snap
              carousel on phones, 3-col grid from sm up. The carousel's own
              overflow is intentional; the negative margins keep it inside the
              page padding so the page itself never scrolls horizontally. */}
          <section aria-label={t.dashboard.learningTracks} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Compass className="w-4 h-4 text-indigo-500 dark:text-indigo-400" aria-hidden="true" />
                {t.dashboard.learningTracks}
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {t.dashboard.coreModules}
              </span>
            </div>
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 -mx-4 px-4 pb-2 sm:-mx-6 sm:px-6 md:grid md:grid-cols-3 md:overflow-visible md:mx-0 md:px-0 md:pb-0">
              {TRACK_TYPES.map((type) => (
                <LearningTrackCard key={type} type={type} count={trackCounts[type]} />
              ))}
            </div>
          </section>

          {/* Recommended for You — the page's real data feed (GET /courses),
              across all three course types. */}
          <section aria-label={t.dashboard.recommendedForYou} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" aria-hidden="true" />
                {t.dashboard.recommendedForYou}
              </h2>
              <Link
                to="/courses"
                className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-lg px-1"
              >
                {t.common.viewAll}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>

            {coursesError && <p className="text-sm font-medium text-rose-500">{coursesError}</p>}

            {!coursesError && courses.length === 0 && (
              <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
                {t.dashboard.noCoursesYet}
              </p>
            )}

            {/* Horizontal snap carousel on phones (mirrors Learning Tracks
                above) so cards keep their real desktop size instead of
                stacking full-width; reverts to the existing sm:grid-cols-2
                xl:grid-cols-3 grid from 640px up, unchanged. */}
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 -mx-4 px-4 pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible sm:mx-0 sm:px-0 sm:pb-0 sm:gap-4 xl:grid-cols-3">
              {courses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  progress={progressByCourse?.get(course.id) ?? null}
                />
              ))}
            </div>
          </section>
        </div>

        {/* ---- Desktop-only right widget column ---- */}
        {/* Both instances share the ONE fetch above — only one is ever visible
            at a time, and rendering the same payload twice costs no request. */}
        <div className="hidden lg:block w-80 flex-shrink-0">
          <UserSidebar
            analytics={analytics}
            onRetryAnalytics={() => setAnalyticsAttempt((n) => n + 1)}
          />
        </div>
      </div>
    </StudentLayout>
  );
};

export default UserHome;
