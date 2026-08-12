import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { authService } from '../../services/authService';

// Personalized Onboarding & Placement Test — the APP-WIDE onboarding gate.
//
// PURELY SYNCHRONOUS, NO NETWORK CALL, SAME SHAPE AS ProtectedRoute. This is
// the single biggest design decision in this feature: an earlier draft
// gated the whole student app behind a fresh GET /placement/status call on
// every session boot, with an unspecified failure mode — directly risking
// this feature's own non-negotiable requirement ("never trap an existing
// user") on a transient network blip. Instead, `onboarded` rides on
// GET /users/me, a request that ALREADY EXISTS, is ALREADY fetched at every
// login (see LoginForm/RegisterForm's enterSession), and already has tested
// error handling — exactly like `emailVerified` does today. By the time
// this component ever renders, `authService.getUser()?.onboarded` is
// already populated from that same response.
//
// `onboarded !== true` (never `=== false`) is deliberate: it also catches
// `undefined`, the one real edge case — enterSession's getProfile() call
// failing right after register/login, leaving the stored user on a stale
// shape with no `onboarded` field at all. Treating "unknown" the same as
// "needs onboarding" is the safe default given the asymmetric cost: showing
// the wizard to an already-onboarded user is self-correcting (OnboardingPage
// immediately calls GET /placement/status, and a true `onboarded: true`
// there bounces straight back to /home and patches localStorage so it
// doesn't repeat) — silently skipping onboarding for a genuinely new user
// would not be.
//
// ADMIN accounts are excluded by role check: an admin has no learningGoal,
// no PlacementAttempt, no Roadmap, and no product reason to ever see this
// wizard.
const OnboardingGateBoundary: React.FC = () => {
  const user = authService.getUser();
  const location = useLocation();

  const needsOnboarding = user?.role === 'USER' && user?.onboarded !== true;
  const onOnboardingRoute = location.pathname === '/onboarding';

  if (needsOnboarding && !onOnboardingRoute) {
    return <Navigate to="/onboarding" replace />;
  }
  if (!needsOnboarding && onOnboardingRoute) {
    return <Navigate to="/home" replace />;
  }
  return <Outlet />;
};

export default OnboardingGateBoundary;
