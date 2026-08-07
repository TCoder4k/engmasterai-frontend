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

// Sprint 05: "My Courses" (desktop) / "Courses" (mobile) — both pointing at
// the generic /courses catalog — became a single Grammar module entry at
// /grammar. Speaking and Writing are explicitly deferred to a later roadmap
// and must not appear in either navigation.
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
  ])('shows no Speaking or Writing item in the %s', (_label, ui) => {
    renderAt(ui, '/home');

    expect(screen.queryByText(/speaking/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/writing/i)).not.toBeInTheDocument();
  });
});

describe('StudentDesktopSidebar navigation', () => {
  // Sprint 11 — ONE entry, "Audio Practice", for both Dictation and
  // Shadowing (was two separate NavLinks: "Topics" for Dictation, a second
  // "Shadowing" item). The catalog it points at gained an in-page
  // Dictation<->Shadowing toggle, so a second nav item pointing at the same
  // shared catalog became redundant, and merging them is what keeps the
  // sidebar short. See StudentDesktopSidebar's own comment on this link.
  it('shows an "Audio Practice" item, not "Practice", "Listening" or a separate "Shadowing" item, linking to /practice/listening', () => {
    renderAt(<StudentDesktopSidebar />, '/home');

    expect(screen.queryByText('Practice')).not.toBeInTheDocument();
    expect(screen.queryByText('Listening')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^shadowing$/i })).not.toBeInTheDocument();
    const audioPracticeLink = screen.getByRole('link', { name: /audio practice/i });
    expect(audioPracticeLink).toHaveAttribute('href', '/practice/listening');
  });

  it('marks the Audio Practice link active when the current route is /practice/listening', () => {
    renderAt(<StudentDesktopSidebar />, '/practice/listening');

    const audioPracticeLink = screen.getByRole('link', { name: /audio practice/i });
    expect(audioPracticeLink).toHaveAttribute('aria-current', 'page');
  });

  // The merged entry's whole point: it must ALSO read as current on the
  // other mode's route, which does not share /practice/listening's prefix
  // and which NavLink's own matching cannot express (see the component's
  // comment on why this link is a plain `Link`, not a `NavLink`).
  it('also marks the Audio Practice link active when the current route is /practice/shadowing', () => {
    renderAt(<StudentDesktopSidebar />, '/practice/shadowing');

    const audioPracticeLink = screen.getByRole('link', { name: /audio practice/i });
    expect(audioPracticeLink).toHaveAttribute('aria-current', 'page');
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
  // Sprint 11 — see StudentDesktopSidebar navigation's matching comment: the
  // one bottom-nav slot into the catalog is "Audio Practice" now, not
  // "Listening" and not two separate slots, because the catalog itself
  // picks Dictation vs Shadowing via its own in-page toggle — the mobile
  // answer to reaching Shadowing without a 6th slot here.
  it('shows an "Audio Practice" item, not "Practice" or "Listening", linking to /practice/listening', () => {
    renderAt(<StudentBottomNavigation />, '/home');

    expect(screen.queryByText('Practice')).not.toBeInTheDocument();
    expect(screen.queryByText('Listening')).not.toBeInTheDocument();
    const audioPracticeLink = screen.getByRole('link', { name: /audio practice/i });
    expect(audioPracticeLink).toHaveAttribute('href', '/practice/listening');
  });

  it('marks the Audio Practice item active when the current route is /practice/listening', () => {
    renderAt(<StudentBottomNavigation />, '/practice/listening');

    const audioPracticeLink = screen.getByRole('link', { name: /audio practice/i });
    expect(audioPracticeLink).toHaveAttribute('aria-current', 'page');
  });

  it('also marks the Audio Practice item active when the current route is /practice/shadowing', () => {
    renderAt(<StudentBottomNavigation />, '/practice/shadowing');

    const audioPracticeLink = screen.getByRole('link', { name: /audio practice/i });
    expect(audioPracticeLink).toHaveAttribute('aria-current', 'page');
  });
});
