
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
import ProfilePage from './components/shared/ProfilePage';
import SecurityPage from './components/shared/SecurityPage';
import ProtectedRoute from './components/shared/ProtectedRoute';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginForm />} />
          <Route path="/register" element={<RegisterForm />} />
        </Route>
        <Route path="/home" element={<UserHome />} />

        {/* /admin* requires an authenticated ADMIN; ProtectedRoute redirects
            logged-out visitors to /login and non-admins to /home. This is a
            UX gate — the backend still enforces JWT + @Roles(ADMIN) on
            every request regardless. */}
        <Route element={<ProtectedRoute role="ADMIN" />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/courses" element={<AdminCourses />} />
          <Route path="/admin/courses/:courseId/lessons" element={<AdminLessons />} />
        </Route>

        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/security" element={<SecurityPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
