import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import TopStudentsWidget from './TopStudentsWidget';
import * as analyticsService from '../../services/analyticsService';
import type { PublicTopStudent } from '../../services/analyticsService';

// GET /analytics/top-students is deliberately NOT admin-gated and its DTO has
// no `email` field at all (see the backend's PublicTopStudentDto) — a fellow
// student must never see another student's email address. This file pins
// that privacy contract at the component level too, alongside the usual
// loading/error/empty states every self-fetching dashboard widget needs
// (same convention as UserSidebar.test.tsx's DuoLeaderboardWidget coverage).

const renderWidget = () =>
  render(
    <LanguageProvider>
      <TopStudentsWidget />
    </LanguageProvider>,
  );

const student = (overrides: Partial<PublicTopStudent> = {}): PublicTopStudent => ({
  id: 'user-1',
  name: 'Khánh Linh Phạm',
  level: 6,
  totalStudySeconds: 3600,
  completedTasks: 0,
  ...overrides,
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('TopStudentsWidget — loading and error states', () => {
  it('shows skeleton rows while loading', () => {
    vi.spyOn(analyticsService, 'getTopStudents').mockReturnValue(new Promise(() => {}));
    const { container } = renderWidget();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows an error message and a working retry button on failure', async () => {
    vi.spyOn(analyticsService, 'getTopStudents').mockRejectedValueOnce(new Error('boom'));
    renderWidget();

    expect(await screen.findByText(/could not load your stats/i)).toBeInTheDocument();

    vi.spyOn(analyticsService, 'getTopStudents').mockResolvedValueOnce([student()]);
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText('Khánh Linh Phạm')).toBeInTheDocument();
  });

  it('shows an empty-state message when no student has any study time yet', async () => {
    vi.spyOn(analyticsService, 'getTopStudents').mockResolvedValue([]);
    renderWidget();
    expect(await screen.findByText(/no study data yet/i)).toBeInTheDocument();
  });
});

describe('TopStudentsWidget — rendered rows', () => {
  it('renders rank, name, time, tasks and level for each student', async () => {
    vi.spyOn(analyticsService, 'getTopStudents').mockResolvedValue([
      student({ id: 'a', name: 'Top Student', totalStudySeconds: 6300, completedTasks: 5, level: 3 }),
    ]);
    renderWidget();

    expect(await screen.findByText('Top Student')).toBeInTheDocument();
    expect(screen.getByText('1h 45m')).toBeInTheDocument();
    expect(screen.getByText('5 tasks')).toBeInTheDocument();
    expect(screen.getByText('Lv 3')).toBeInTheDocument();
  });

  it('never renders an email address anywhere, even though PublicTopStudent has no such field to leak', async () => {
    vi.spyOn(analyticsService, 'getTopStudents').mockResolvedValue([
      student({ name: 'Khánh Linh Phạm' }),
    ]);
    const { container } = renderWidget();

    await waitFor(() => expect(screen.getByText('Khánh Linh Phạm')).toBeInTheDocument());
    expect(container.textContent).not.toMatch(/@/);
  });
});
