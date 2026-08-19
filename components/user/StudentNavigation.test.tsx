import type { ReactElement } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import StudentDesktopSidebar from './StudentDesktopSidebar';
import StudentBottomNavigation from './StudentBottomNavigation';

// "Nghe - nói" (Audio Practice) now opens /practice, the shared
// Listening/Shadowing + Speaking Partner mode-selection hub — realigned from
// an earlier state where this link went straight to /practice/listening and
// Speaking Partner had its own separate nav item. These tests guard the
// navigation-restructure requirements: no "Practice" label left bare in
// primary nav, correct destination, no duplicate Speaking entry, and
// NavLink's own aria-current (or the hand-computed equivalent) reflects the
// active route (used here instead of asserting exact CSS class strings,
// which are an implementation detail).
const renderAt = (ui: ReactElement, initialPath: string) =>
  render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>
    </LanguageProvider>,
  );

afterEach(() => cleanup());

// Sprint 05: "My Courses" (desktop) / "Courses" (mobile) — both pointing at
// the generic /courses catalog — became a single Grammar module entry at
// /grammar. Writing is still deferred and must not appear in either
// navigation. Speaking Partner shipped in Sprint 13 but does NOT get its own
// nav item — it's reached through "Nghe - nói" -> /practice instead (see
// "StudentDesktopSidebar navigation" / "StudentBottomNavigation" below) —
// so it belongs in this same "must not appear as a separate item" check.
describe('Grammar module navigation (Sprint 05)', () => {
  it('the desktop sidebar shows Grammar, not My Courses, linking to /grammar', () => {
    renderAt(<StudentDesktopSidebar />, '/home');

    expect(screen.queryByText('My Courses')).not.toBeInTheDocument();
    const grammarLink = screen.getByRole('link', { name: /grammar/i });
    expect(grammarLink).toHaveAttribute('href', '/grammar');
  });

  it('the bottom navigation shows Grammar, not Courses, linking to /grammar', () => {
    renderAt(<StudentBottomNavigation />, '/home');

    expect(screen.queryByText('Courses')).not.toBeInTheDocument();
    expect(screen.queryByText('My Courses')).not.toBeInTheDocument();
    const grammarLink = screen.getByRole('link', { name: /grammar/i });
    expect(grammarLink).toHaveAttribute('href', '/grammar');
  });

  it.each([
    ['desktop sidebar', <StudentDesktopSidebar key="d" />],
    ['bottom navigation', <StudentBottomNavigation key="m" />],
  ])('marks Grammar active on /grammar in the %s', (_label, ui) => {
    renderAt(ui, '/grammar');

    expect(screen.getByRole('link', { name: /grammar/i })).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark Grammar active on an unrelated route', () => {
    renderAt(<StudentDesktopSidebar />, '/vocab');

    expect(screen.getByRole('link', { name: /grammar/i })).not.toHaveAttribute('aria-current');
  });

  it.each([
    ['desktop sidebar', <StudentDesktopSidebar key="d" />],
    ['bottom navigation', <StudentBottomNavigation key="m" />],
  ])('shows no Writing item and no separate Speaking item in the %s', (_label, ui) => {
    renderAt(ui, '/home');

    expect(screen.queryByText(/writing/i)).not.toBeInTheDocument();
    // "Speaking" must not appear as a link name of its own — it's reached
    // through the "Audio Practice"/"Nghe - nói" item instead, not a
    // duplicate top-level entry.
    expect(screen.queryByRole('link', { name: /^speaking$/i })).not.toBeInTheDocument();
  });
});

describe('StudentDesktopSidebar navigation', () => {
  // "Audio Practice" ("Nghe - nói") now opens /practice, the shared
  // Listening/Shadowing + Speaking Partner hub — not /practice/listening
  // directly, and not a separate "Speaking"/"Shadowing" item. See
  // StudentDesktopSidebar's own comment on this link.
  it('shows an "Audio Practice" item, not "Practice", "Listening" or a separate "Shadowing" item, linking to /practice', () => {
    renderAt(<StudentDesktopSidebar />, '/home');

    expect(screen.queryByText('Practice')).not.toBeInTheDocument();
    expect(screen.queryByText('Listening')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^shadowing$/i })).not.toBeInTheDocument();
    const audioPracticeLink = screen.getByRole('link', { name: /audio practice/i });
    expect(audioPracticeLink).toHaveAttribute('href', '/practice');
  });

  it('marks the Audio Practice link active when the current route is /practice', () => {
    renderAt(<StudentDesktopSidebar />, '/practice');

    const audioPracticeLink = screen.getByRole('link', { name: /audio practice/i });
    expect(audioPracticeLink).toHaveAttribute('aria-current', 'page');
  });

  it.each([
    ['/practice/listening'],
    ['/practice/shadowing'],
    ['/practice/speaking'],
  ])('also marks the Audio Practice link active when the current route is %s', (path) => {
    renderAt(<StudentDesktopSidebar />, path);

    const audioPracticeLink = screen.getByRole('link', { name: /audio practice/i });
    expect(audioPracticeLink).toHaveAttribute('aria-current', 'page');
  });

  it.each([
    ['/practice/vocab/deck-1'],
    ['/practice/review'],
  ])('does NOT mark the Audio Practice link active on %s, a different /practice section', (path) => {
    renderAt(<StudentDesktopSidebar />, path);

    const audioPracticeLink = screen.getByRole('link', { name: /audio practice/i });
    expect(audioPracticeLink).not.toHaveAttribute('aria-current');
  });

  it('does not mark the Audio Practice link active on an unrelated route', () => {
    renderAt(<StudentDesktopSidebar />, '/home');

    const audioPracticeLink = screen.getByRole('link', { name: /audio practice/i });
    expect(audioPracticeLink).not.toHaveAttribute('aria-current');
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
  // "Audio Practice" ("Nghe - nói") opens /practice, the shared
  // Listening/Shadowing + Speaking Partner hub — five slots total, no
  // separate "Speaking" sixth slot (see StudentBottomNavigation's own
  // comment on this item).
  it('shows an "Audio Practice" item, not "Practice" or "Listening", linking to /practice', () => {
    renderAt(<StudentBottomNavigation />, '/home');

    expect(screen.queryByText('Practice')).not.toBeInTheDocument();
    expect(screen.queryByText('Listening')).not.toBeInTheDocument();
    const audioPracticeLink = screen.getByRole('link', { name: /audio practice/i });
    expect(audioPracticeLink).toHaveAttribute('href', '/practice');
  });

  it('marks the Audio Practice item active when the current route is /practice', () => {
    renderAt(<StudentBottomNavigation />, '/practice');

    const audioPracticeLink = screen.getByRole('link', { name: /audio practice/i });
    expect(audioPracticeLink).toHaveAttribute('aria-current', 'page');
  });

  it.each([
    ['/practice/listening'],
    ['/practice/shadowing'],
    ['/practice/speaking'],
  ])('also marks the Audio Practice item active when the current route is %s', (path) => {
    renderAt(<StudentBottomNavigation />, path);

    const audioPracticeLink = screen.getByRole('link', { name: /audio practice/i });
    expect(audioPracticeLink).toHaveAttribute('aria-current', 'page');
  });

  it.each([
    ['/practice/vocab/deck-1'],
    ['/practice/review'],
  ])('does NOT mark the Audio Practice item active on %s, a different /practice section', (path) => {
    renderAt(<StudentBottomNavigation />, path);

    const audioPracticeLink = screen.getByRole('link', { name: /audio practice/i });
    expect(audioPracticeLink).not.toHaveAttribute('aria-current');
  });
});
