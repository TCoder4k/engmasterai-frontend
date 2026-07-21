
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './components/HomePage';
import { AuthLayout } from './components/auth/AuthLayout';
import { LoginForm } from './components/auth/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm';
import UserHome from './components/user/UserHome';
import AdminDashboard from './components/admin/AdminDashboard';
import AdminUsers from './components/admin/AdminUsers';
import AdminCourses from './components/admin/AdminCourses';
import AdminLessons from './components/admin/AdminLessons';
import AdminVocabLibraries from './components/admin/AdminVocabLibraries';
import AdminVocabDecks from './components/admin/AdminVocabDecks';
import AdminVocabWords from './components/admin/AdminVocabWords';
import AdminVocabWordEditor from './components/admin/AdminVocabWordEditor';
import AdminVocabDeckWords from './components/admin/AdminVocabDeckWords';
import VocabLibraryPage from './components/vocab/VocabLibraryPage';
import LibraryDetailPage from './components/vocab/LibraryDetailPage';
import DeckDetailPage from './components/vocab/DeckDetailPage';
import WordDetailPage from './components/vocab/WordDetailPage';
import CourseCatalogPage from './components/course/CourseCatalogPage';
import CourseDetailPage from './components/course/CourseDetailPage';
import LessonPage from './components/lesson/LessonPage';
import ProfilePage from './components/shared/ProfilePage';
import SecurityPage from './components/shared/SecurityPage';
import ProtectedRoute from './components/shared/ProtectedRoute';
import { ThemeProvider } from './theme/ThemeProvider';
import { LanguageProvider } from './i18n/LanguageProvider';

const App: React.FC = () => {
  return (
    // Theme + language are app-global so every student-facing page (and any
    // future course/lesson page) can consume them — not just the dashboard.
    <ThemeProvider>
    <LanguageProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginForm />} />
          <Route path="/register" element={<RegisterForm />} />
        </Route>
        {/* /home, /vocab*, /courses*, /profile, /security all require any
            authenticated user (no role prop). /home, /profile, /security
            used to have no ProtectedRoute wrapper at all (Sprint 01B closed
            that gap — see docs/memory.md); each page's own ad-hoc
            self-redirect useEffect was removed in the same change, since
            this wrapper now does that job (and does it before the page's
            own JSX ever renders, not one tick after). */}
        <Route element={<ProtectedRoute />}>
          <Route path="/home" element={<UserHome />} />
          <Route path="/vocab" element={<VocabLibraryPage />} />
          <Route path="/vocab/libraries/:id" element={<LibraryDetailPage />} />
          <Route path="/vocab/decks/:id" element={<DeckDetailPage />} />
          <Route path="/vocab/words/:id" element={<WordDetailPage />} />
          <Route path="/courses" element={<CourseCatalogPage />} />
          <Route path="/courses/:id" element={<CourseDetailPage />} />
          <Route path="/courses/:courseId/lessons/:lessonId" element={<LessonPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/security" element={<SecurityPage />} />
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
          <Route path="/admin/vocab" element={<AdminVocabLibraries />} />
          <Route path="/admin/vocab/libraries/:libraryId/decks" element={<AdminVocabDecks />} />
          <Route path="/admin/vocab/words" element={<AdminVocabWords />} />
          <Route path="/admin/vocab/words/new" element={<AdminVocabWordEditor />} />
          <Route path="/admin/vocab/words/:wordId/edit" element={<AdminVocabWordEditor />} />
          <Route path="/admin/vocab/decks/:deckId/words" element={<AdminVocabDeckWords />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </LanguageProvider>
    </ThemeProvider>
  );
};

export default App;
