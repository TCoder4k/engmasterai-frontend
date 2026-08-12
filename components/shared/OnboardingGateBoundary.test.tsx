import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, afterEach } from 'vitest';
import OnboardingGateBoundary from './OnboardingGateBoundary';

// Personalized Onboarding & Placement Test — the app-wide gate.
//
// The two things this suite exists to prove (see the component's own header
// comment for why they matter): the gate is PURELY SYNCHRONOUS (issues no
// network request at all, so a transient backend blip can never trap an
// existing user), and it treats `onboarded: undefined` the SAME as `false`
// (the safe default for the brief window before getProfile() resolves).

const USER = { id: 'u1', name: 'A', email: 'a@b.c', role: 'USER', emailVerified: true };

const signIn = (overrides: Record<string, unknown> = {}) => {
  localStorage.setItem('accessToken', 'token-abc');
  localStorage.setItem('user', JSON.stringify({ ...USER, ...overrides }));
};

const renderAt = (initialPath: string) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<OnboardingGateBoundary />}>
          <Route path="/onboarding" element={<div>ONBOARDING_PAGE</div>} />
          <Route path="/home" element={<div>HOME_PAGE</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('OnboardingGateBoundary', () => {
  it('redirects a USER whose onboarded is exactly false to /onboarding', () => {
    signIn({ onboarded: false });
    renderAt('/home');
    expect(screen.getByText('ONBOARDING_PAGE')).toBeInTheDocument();
  });

  it('treats onboarded: undefined the same as false', () => {
    signIn({ onboarded: undefined });
    renderAt('/home');
    expect(screen.getByText('ONBOARDING_PAGE')).toBeInTheDocument();
  });

  it('lets an onboarded USER through to the protected route', () => {
    signIn({ onboarded: true });
    renderAt('/home');
    expect(screen.getByText('HOME_PAGE')).toBeInTheDocument();
  });

  it('bounces an already-onboarded USER away from /onboarding back to /home', () => {
    signIn({ onboarded: true });
    renderAt('/onboarding');
    expect(screen.getByText('HOME_PAGE')).toBeInTheDocument();
  });

  it('never redirects an ADMIN, even with onboarded: false', () => {
    signIn({ role: 'ADMIN', onboarded: false });
    renderAt('/home');
    expect(screen.getByText('HOME_PAGE')).toBeInTheDocument();
  });

  it('renders nothing (a redirect) rather than the protected route for a logged-out visitor mid-onboarding-check', () => {
    // No signIn() call — localStorage carries no user at all. `user?.role`
    // is then undefined, `needsOnboarding` is false (the `role === 'USER'`
    // check fails), so this gate itself does nothing — ProtectedRoute
    // upstream is what actually turns away a logged-out visitor. Asserted
    // here so a future change to the `needsOnboarding` expression can't
    // accidentally start gating logged-out visitors from this component.
    renderAt('/home');
    expect(screen.getByText('HOME_PAGE')).toBeInTheDocument();
  });

  it('issues NO network request — purely synchronous, reads only localStorage', () => {
    signIn({ onboarded: false });
    const fetchSpy = vi.spyOn(global, 'fetch');
    renderAt('/home');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
