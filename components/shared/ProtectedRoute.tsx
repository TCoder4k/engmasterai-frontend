import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { authService } from '../../services/authService';

interface ProtectedRouteProps {
  // If omitted, only checks that the user is logged in (any role).
  role?: 'USER' | 'ADMIN';
}

// Layout-route guard. Generalizes the self-redirect `useEffect` already used
// by SecurityPage into something reusable for a whole route subtree — wrap
// admin (or any authenticated) routes in <Route element={<ProtectedRoute .../>}>
// and nest the real pages underneath; this renders <Outlet /> only once the
// check passes.
//
// This is a UX gate, not the trust boundary: the backend still enforces JWT
// + @Roles(ADMIN) on every request regardless of what this component decides.
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ role }) => {
  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (role) {
    const user = authService.getUser();
    if (user?.role !== role) {
      // Logged in but wrong role — bounce to the normal user area rather
      // than back to /login (they are authenticated, just not authorized).
      return <Navigate to="/home" replace />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;
