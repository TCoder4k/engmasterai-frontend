
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import HomePage from './components/HomePage';
import { AuthLayout } from './components/auth/AuthLayout';
import { LoginForm } from './components/auth/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm';
import { VerifyEmailPage } from './components/auth/VerifyEmailPage';
import { ForgotPasswordPage } from './components/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import UserHome from './components/user/UserHome';
import AdminDashboard from './components/admin/AdminDashboard';
import AdminUsers from './components/admin/AdminUsers';
import AdminCourses from './components/admin/AdminCourses';
import AdminLessons from './components/admin/AdminLessons';
import AdminLessonQuiz from './components/admin/AdminLessonQuiz';
import AdminVocabLibraries from './components/admin/AdminVocabLibraries';
import AdminVocabDecks from './components/admin/AdminVocabDecks';
import AdminVocabWords from './components/admin/AdminVocabWords';
import AdminVocabWordEditor from './components/admin/AdminVocabWordEditor';
import AdminVocabDeckWords from './components/admin/AdminVocabDeckWords';
import AdminListeningContents from './components/admin/AdminListeningContents';
import AdminListeningCategories from './components/admin/AdminListeningCategories';
import AdminListeningEditor from './components/admin/AdminListeningEditor';
import AdminPlacementQuestions from './components/admin/AdminPlacementQuestions';
import VocabLibraryPage from './components/vocab/VocabLibraryPage';
import LibraryDetailPage from './components/vocab/LibraryDetailPage';
import DeckDetailPage from './components/vocab/DeckDetailPage';
import WordDetailPage from './components/vocab/WordDetailPage';
import GrammarRoadmapPage from './components/grammar/GrammarRoadmapPage';
import CourseCatalogPage from './components/course/CourseCatalogPage';
import CourseDetailPage from './components/course/CourseDetailPage';
import LessonPage from './components/lesson/LessonPage';
import PracticeHubPage from './components/practice/PracticeHubPage';
import VocabPracticeSessionPage from './components/practice/vocab/VocabPracticeSessionPage';
import ReviewSessionPage from './components/practice/review/ReviewSessionPage';
import ListeningCatalogPage from './components/practice/listening/ListeningCatalogPage';
import ShadowingCatalogPage from './components/practice/listening/ShadowingCatalogPage';
import ListeningContentPage from './components/practice/listening/ListeningContentPage';
import DictationModePanel from './components/practice/listening/DictationModePanel';
import ShadowingModePanel from './components/practice/listening/ShadowingModePanel';
import SpeakingCatalogPage from './components/practice/speaking/SpeakingCatalogPage';
import SpeakingScenarioPage from './components/practice/speaking/SpeakingScenarioPage';
import SpeakingSessionPage from './components/practice/speaking/SpeakingSessionPage';
import ProfilePage from './components/shared/ProfilePage';
import SecurityPage from './components/shared/SecurityPage';
import ProtectedRoute from './components/shared/ProtectedRoute';
import OnboardingGateBoundary from './components/shared/OnboardingGateBoundary';
import OnboardingPage from './components/onboarding/OnboardingPage';
import GamificationBoundary from './components/shared/GamificationProvider';
import StudyTimeBoundary from './components/shared/StudyTimeBoundary';
import AssistantBoundary from './components/shared/assistant/AssistantBoundary';
import { ThemeProvider } from './theme/ThemeProvider';
import { LanguageProvider } from './i18n/LanguageProvider';
import { SoundProvider } from './components/shared/SoundProvider';
import { purgeLegacyLocalProgress } from './services/lessonProgress';

// Sprint 07 — video and theory completion moved to the server, and the old
// device-local records are DISCARDED rather than imported: they were always
// client-writable, so importing them would have turned forged keys into real
// database rows. Run once at module load, before anything can read them.
//
// Nothing writes these keys any more, so there is no race and no version
// marker is needed. DELETE THIS (and the function) in the cleanup sprint.
purgeLegacyLocalProgress();

const App: React.FC = () => {
  return (
    // Theme + language are app-global so every student-facing page (and any
    // future course/lesson page) can consume them — not just the dashboard.
    <ThemeProvider>
    <LanguageProvider>
    <SoundProvider>
    {/*
      Sprint 06B.5 — reducedMotion="user" makes EVERY framer-motion
      animation in the app honour the OS "reduce motion" setting by
      default. This is a net improvement on what came before: the
      hand-written practice-* keyframes in index.html already respected
      the preference, but the Tailwind transition and animate utilities
      used across the app ignored it, and no useReducedMotion hook
      existed anywhere.
    */}
    <MotionConfig reducedMotion="user">
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginForm />} />
          <Route path="/register" element={<RegisterForm />} />
          {/* Public — the email link lands here; see VerifyEmailPage's own
              doc comment for why this is a GET page that fires an explicit
              POST, not a bare backend GET link (Sprint 02B). */}
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          {/* Public (Sprint 02C) — forgot/reset password. Unlike
              /verify-email, /reset-password's page load is side-effect-free;
              the actual POST only fires on form submit (see
              ResetPasswordPage's own doc comment). */}
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>
        {/* /home, /vocab*, /courses*, /profile, /security all require any
            authenticated user (no role prop). /home, /profile, /security
            used to have no ProtectedRoute wrapper at all (Sprint 01B closed
            that gap — see docs/memory.md); each page's own ad-hoc
            self-redirect useEffect was removed in the same change, since
            this wrapper now does that job (and does it before the page's
            own JSX ever renders, not one tick after). */}
        <Route element={<ProtectedRoute />}>
          {/* Personalized Onboarding & Placement Test — the APP-WIDE
              onboarding gate, wrapping every other student route below it
              (including the GamificationBoundary/StudyTimeBoundary pair) so
              a not-yet-onboarded USER is redirected to /onboarding before
              ANY of those boundaries' own requests fire — no gamification
              profile fetch, no study-time heartbeat, nothing, until
              onboarding is actually done. /onboarding itself sits INSIDE
              this gate but OUTSIDE both of those boundaries: the wizard has
              no use for either while it runs. See
              OnboardingGateBoundary.tsx's header note for why this check is
              purely synchronous (no network call). */}
          <Route element={<OnboardingGateBoundary />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          {/* Phase 7 — the retake entry point (RoadmapCard on /home links
              here). A SIBLING path, not a query param on /onboarding: the
              gate's own rule only ever compares pathname === '/onboarding'
              exactly, so '/onboarding/retake' falls through BOTH of its
              special cases untouched — not-yet-onboarded users still get
              redirected to the real /onboarding (correct: they cannot
              "retake" a test they never took), and already-onboarded users
              reach this route instead of being bounced home, with zero
              changes to OnboardingGateBoundary.tsx or its tests. Left
              OUTSIDE Gamification/StudyTime, same as /onboarding itself:
              the placement test earns no XP and tracks no study time either
              way (see the backend's own "diagnostic, not graded" note). */}
          <Route path="/onboarding/retake" element={<OnboardingPage retake />} />
          {/* Sprint 10 — GamificationBoundary wraps the STUDENT routes only, so
              the XP profile is fetched once per session and survives every
              navigation inside this group. It is nested here rather than folded
              into ProtectedRoute (which stays a pure navigation gate) and
              rather than placed in StudentLayout (which each page renders for
              itself, so it would remount and refetch on every page change).
              The admin group below sits outside it by structure and therefore
              issues no gamification request at all. */}
          <Route element={<GamificationBoundary />}>
          {/* Sprint 10.5 — StudyTimeBoundary owns the ONE interval that measures
              active study seconds, for the same structural reasons as the
              boundary above it: mounted once per session, survives every
              navigation inside the student group, and excluded from the admin
              group by structure rather than by a check. Pages contribute a
              useStudyActivity registration and nothing else — no page owns a
              timer. Nesting order between the two boundaries is arbitrary;
              neither reads the other. */}
          <Route element={<StudyTimeBoundary />}>
          {/* Floating Dictionary + Engy — nested here for the same structural
              reasons as the two boundaries above: mounted once per session,
              survives every navigation, excluded from admin by structure.
              Nesting order among these three is arbitrary; none of them
              reads another. It ALSO excludes /onboarding and
              /onboarding/retake by structure (they sit outside this whole
              group, same as they already do for the two boundaries above) —
              that is the entire frontend enforcement of "Engy is
              unavailable during the Placement Test": no runtime check, just
              route nesting. See AssistantBoundary.tsx's own header. */}
          <Route element={<AssistantBoundary />}>
          <Route path="/home" element={<UserHome />} />
          <Route path="/vocab" element={<VocabLibraryPage />} />
          <Route path="/vocab/libraries/:id" element={<LibraryDetailPage />} />
          <Route path="/vocab/decks/:id" element={<DeckDetailPage />} />
          <Route path="/vocab/words/:id" element={<WordDetailPage />} />
          {/* Sprint 05/06 — Grammar is a first-class student module, and
              /grammar is its ROADMAP (Grammar -> Roadmap -> Course -> Lesson
              -> Learning Engine). Courses and lessons still live on the
              /courses routes below, so there is exactly one Course domain.
              /courses itself stays registered as the all-type catalog (the
              Dashboard links to it, and students have /courses/... deep
              links already persisted in localStorage) — it is simply no
              longer primary navigation. */}
          <Route path="/grammar" element={<GrammarRoadmapPage />} />
          <Route path="/courses" element={<CourseCatalogPage />} />
          <Route path="/courses/:id" element={<CourseDetailPage />} />
          <Route path="/courses/:courseId/lessons/:lessonId" element={<LessonPage />} />
          {/* Sprint 03A/B/C — Practice Hub. /practice/vocab/:deckId hosts the
              vocabulary practice modes (flashcard/dictation/games);
              /practice/listening hosts the seeded listening dictation
              workspace. As of Sprint 04C, Flashcard's ratings are real,
              persisted per-user SRS progress — see that component's own
              header comment. /practice/review (Sprint 04D) is the
              dedicated due-queue review session, separate from whole-deck
              Flashcard practice. */}
          <Route path="/practice" element={<PracticeHubPage />} />
          <Route path="/practice/vocab/:deckId" element={<VocabPracticeSessionPage />} />
          <Route path="/practice/review" element={<ReviewSessionPage />} />
          {/* Sprint 03E / Sprint 11 Phase 2 — /practice/listening is the
              CATALOG, now read from the Listening backend rather than a
              client-side seed array.

              /practice/listening/:contentId is a LAYOUT route: it owns the
              media player and the selected sentence, and each practice mode
              renders beneath it. That nesting is what will let a student switch
              Dictation -> Shadowing without the YouTube iframe being destroyed
              and rebuilt, which a self-contained page cannot promise.

              The id is a UUID — Listening deliberately introduced no slug, so
              the five old seed slugs resolve to nothing and render the same
              not-found surface as any other unknown id (an accepted, approved
              break: none of that content was ever published).

              The index route redirects (replace) to the first mode the
              recording actually enables; a mode it does not enable is a
              not-found, never a redirect. Every path here survives a direct
              refresh — they are registered routes, not client-only state. */}
          <Route path="/practice/listening" element={<ListeningCatalogPage />} />
          {/* Sprint 11 — the Shadowing sidebar's own entry point. Same
              recordings and the same /practice/listening/:contentId/shadowing
              destination as clicking through from the Listening catalog; only
              the catalog's default mode filter and card status differ. See
              ShadowingCatalogPage.tsx. */}
          <Route path="/practice/shadowing" element={<ShadowingCatalogPage />} />
          <Route path="/practice/listening/:contentId" element={<ListeningContentPage />}>
            <Route index element={<></>} />
            <Route path="dictation" element={<DictationModePanel />} />
            <Route path="shadowing" element={<ShadowingModePanel />} />
          </Route>
          {/* Speaking Partner (Phase 1+2) — push-to-talk voice conversation.
              Same nesting as /practice/listening: inside AssistantBoundary/
              StudyTimeBoundary/GamificationBoundary, so it earns study time
              like every other learning surface (no XP yet — deliberately
              deferred, see the backend module's own header comment).
              /practice/speaking/:scenarioId/:exerciseId is the session page;
              unlike Listening's layout-route nesting, each level here is its
              own full page rather than a shared player shell — there is no
              persistent media element to preserve across a mode switch. */}
          <Route path="/practice/speaking" element={<SpeakingCatalogPage />} />
          <Route path="/practice/speaking/:scenarioId" element={<SpeakingScenarioPage />} />
          <Route
            path="/practice/speaking/:scenarioId/:exerciseId"
            element={<SpeakingSessionPage />}
          />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/security" element={<SecurityPage />} />
          </Route>
          </Route>
          </Route>
          </Route>
        </Route>

        {/* /admin* requires an authenticated ADMIN; ProtectedRoute redirects
            logged-out visitors to /login and non-admins to /home. This is a
            UX gate — the backend still enforces JWT + @Roles(ADMIN) on
            every request regardless. */}
        <Route element={<ProtectedRoute role="ADMIN" />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/courses" element={<AdminCourses />} />
          <Route path="/admin/courses/:courseId/lessons" element={<AdminLessons />} />
          <Route path="/admin/lessons/:lessonId/quiz" element={<AdminLessonQuiz />} />
          {/* Sprint 06D — the same editor, pointed at the lesson's PRACTICE
              task. Parameterised rather than duplicated: identical DTOs, one
              backend service, so a second editor would be two places to fix
              every authoring bug. */}
          <Route
            path="/admin/lessons/:lessonId/practice"
            element={<AdminLessonQuiz taskKind="practice" />}
          />
          {/* Sprint 11 — Listening content authoring. `/categories` is declared
              BEFORE `/:contentId` so it isn't swallowed by the dynamic route,
              the same ordering GET /courses/manage needs on the backend.
              The id is a UUID: Listening deliberately introduced no slug, so
              these routes look like every other id-bearing route in the app. */}
          <Route path="/admin/listening" element={<AdminListeningContents />} />
          <Route
            path="/admin/listening/categories"
            element={<AdminListeningCategories />}
          />
          <Route
            path="/admin/listening/:contentId"
            element={<AdminListeningEditor />}
          />
          <Route path="/admin/vocab" element={<AdminVocabLibraries />} />
          <Route path="/admin/vocab/libraries/:libraryId/decks" element={<AdminVocabDecks />} />
          <Route path="/admin/vocab/words" element={<AdminVocabWords />} />
          <Route path="/admin/vocab/words/new" element={<AdminVocabWordEditor />} />
          <Route path="/admin/vocab/words/:wordId/edit" element={<AdminVocabWordEditor />} />
          <Route path="/admin/vocab/decks/:deckId/words" element={<AdminVocabDeckWords />} />
          {/* Personalized Onboarding & Placement Test, Phase 2 — the
              dedicated question bank. Standalone (not nested under
              /admin/courses or /admin/vocab): PlacementQuestion has no
              parent course/lesson/library, it is its own flat bank. */}
          <Route path="/admin/placement/questions" element={<AdminPlacementQuestions />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </MotionConfig>
    </SoundProvider>
    </LanguageProvider>
    </ThemeProvider>
  );
};

export default App;
