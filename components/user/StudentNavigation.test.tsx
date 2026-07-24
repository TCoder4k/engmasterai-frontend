import type { ReactElement } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import StudentDesktopSidebar from './StudentDesktopSidebar';
import StudentBottomNavigation from './StudentBottomNavigation';

// Sprint 03D: the generic "Practice" nav item was replaced by a dedicated
// Listening entry pointing directly at /practice/listening. These tests
// guard the navigation-restructure requirements: no "Practice" label left
// in primary nav, correct destination, and NavLink's own aria-current
// reflects the active route (used here instead of asserting exact CSS
// class strings, which are an implementation detail).
const renderAt = (ui: ReactElement, initialPath: string) =>
  render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>
    </LanguageProvider>,
  );

afterEach(() => cleanup());

describe('StudentDesktopSidebar navigation', () => {
  it('shows a "Listening" item, not "Practice", linking to /practice/listening', () => {
    renderAt(<StudentDesktopSidebar />, '/home');

    expect(screen.queryByText('Practice')).not.toBeInTheDocument();
    const listeningLink = screen.getByRole('link', { name: /listening/i });
    expect(listeningLink).toHaveAttribute('href', '/practice/listening');
  });

  it('marks the Listening link active when the current route is /practice/listening', () => {
    renderAt(<StudentDesktopSidebar />, '/practice/listening');

    const listeningLink = screen.getByRole('link', { name: /listening/i });
    expect(listeningLink).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark the Listening link active on an unrelated route', () => {
    renderAt(<StudentDesktopSidebar />, '/home');

    const listeningLink = screen.getByRole('link', { name: /listening/i });
    expect(listeningLink).not.toHaveAttribute('aria-current');
  });
});

describe('EngMasterAI brand navigation (Sprint 03E)', () => {
  it('the desktop sidebar brand is a link to /home with an accessible label', () => {
    renderAt(<StudentDesktopSidebar />, '/courses');

    const brandLink = screen.getByRole('link', { name: 'Go to Dashboard' });
    expect(brandLink).toHaveAttribute('href', '/home');
  });

  it('keyboard activation of the brand link navigates to the Dashboard route', async () => {
    render(
      <LanguageProvider>
        <MemoryRouter initialEntries={['/courses']}>
          <Routes>
            <Route path="/courses" element={<StudentDesktopSidebar />} />
            <Route path="/home" element={<div>DASHBOARD_STUB</div>} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>,
    );

    const brandLink = screen.getByRole('link', { name: 'Go to Dashboard' });
    brandLink.focus();
    await userEvent.keyboard('{Enter}');

    expect(await screen.findByText('DASHBOARD_STUB')).toBeInTheDocument();
  });
});

describe('StudentBottomNavigation', () => {
  it('shows a "Listening" item, not "Practice", linking to /practice/listening', () => {
    renderAt(<StudentBottomNavigation />, '/home');

    expect(screen.queryByText('Practice')).not.toBeInTheDocument();
    const listeningLink = screen.getByRole('link', { name: /listening/i });
    expect(listeningLink).toHaveAttribute('href', '/practice/listening');
  });

  it('marks the Listening item active when the current route is /practice/listening', () => {
    renderAt(<StudentBottomNavigation />, '/practice/listening');

    const listeningLink = screen.getByRole('link', { name: /listening/i });
    expect(listeningLink).toHaveAttribute('aria-current', 'page');
  });
});
