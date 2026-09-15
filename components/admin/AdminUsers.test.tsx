import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import AdminUsers from './AdminUsers';
import * as adminStudentService from '../../services/adminStudentService';
import type { AdminStudentListRow } from '../../services/adminStudentService';

const ADMIN_USER = { id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: 'ADMIN' };

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

const rowOf = (overrides: Partial<AdminStudentListRow> = {}): AdminStudentListRow => ({
  id: 'user-1',
  name: 'Nguyen Van A',
  email: 'a@example.com',
  avatarUrl: null,
  role: 'USER',
  level: 2,
  learningGoal: 'TOEIC_650',
  progressPercent: 57,
  completedLessons: 8,
  totalLessons: 14,
  averageTestScore: 78,
  completedTestCount: 5,
  isPro: false,
  proExpiresAt: null,
  isActive: true,
  createdAt: '2026-09-01T00:00:00.000Z',
  ...overrides,
});

const overviewOf = (rows: AdminStudentListRow[]) => ({
  data: rows,
  meta: { total: rows.length, page: 1, limit: 10, totalPages: 1 },
});

const renderPage = () =>
  render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={['/admin/users']}>
          <Routes>
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/users/:id" element={<p>student detail page</p>} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </ThemeProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('accessToken', 'token-abc');
  localStorage.setItem('user', JSON.stringify(ADMIN_USER));
  // Safety net for AdminHeader/AdminSidebar's own network calls (avatar menu,
  // notifications, etc.) — none of them are under test here.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(jsonResponse(404, { message: 'Not found' }))),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('AdminUsers', () => {
  it('renders the new admin overview columns: level/goal, progress, average score, plan and status badges', async () => {
    vi.spyOn(adminStudentService, 'getStudentOverview').mockResolvedValue(
      overviewOf([rowOf()]),
    );
    renderPage();

    expect(await screen.findByText('Nguyen Van A')).toBeInTheDocument();
    expect(screen.getByText('Level 2')).toBeInTheDocument();
    expect(screen.getByText('TOEIC 650+')).toBeInTheDocument();
    expect(screen.getByText('57%')).toBeInTheDocument();
    expect(screen.getByText('8/14')).toBeInTheDocument();
    expect(screen.getByText('78%')).toBeInTheDocument();
    // Scoped to the table: the toolbar's filter dropdowns also render
    // "Active"/"Free" etc. as plain <option> text.
    const table = screen.getByRole('table');
    expect(within(table).getByText('Free')).toBeInTheDocument();
    expect(within(table).getByText('Active')).toBeInTheDocument();
  });

  it('shows the PRO badge with expiry, and the Blocked status badge', async () => {
    vi.spyOn(adminStudentService, 'getStudentOverview').mockResolvedValue(
      overviewOf([
        rowOf({ isPro: true, proExpiresAt: '2026-10-15T00:00:00.000Z', isActive: false }),
      ]),
    );
    renderPage();

    await screen.findByText('Nguyen Van A');
    const table = screen.getByRole('table');
    expect(within(table).getByText('PRO')).toBeInTheDocument();
    expect(within(table).getByText('Blocked')).toBeInTheDocument();
  });

  it('shows a "no roadmap" placeholder instead of a fabricated 0% when progressPercent is null', async () => {
    vi.spyOn(adminStudentService, 'getStudentOverview').mockResolvedValue(
      overviewOf([rowOf({ progressPercent: null, averageTestScore: null })]),
    );
    renderPage();

    expect(await screen.findByText('Chưa có lộ trình')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('navigates to the student detail page when the student name is clicked', async () => {
    vi.spyOn(adminStudentService, 'getStudentOverview').mockResolvedValue(
      overviewOf([rowOf()]),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /nguyen van a/i }));

    expect(await screen.findByText('student detail page')).toBeInTheDocument();
  });

  it('navigates to the student detail page via the row action menu\'s "Xem hồ sơ" item', async () => {
    vi.spyOn(adminStudentService, 'getStudentOverview').mockResolvedValue(
      overviewOf([rowOf()]),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /thêm thao tác/i }));
    await user.click(await screen.findByRole('button', { name: /^xem hồ sơ$/i }));

    expect(await screen.findByText('student detail page')).toBeInTheDocument();
  });

  it('filters the list when the status/plan dropdowns change', async () => {
    const overviewSpy = vi
      .spyOn(adminStudentService, 'getStudentOverview')
      .mockResolvedValue(overviewOf([rowOf()]));
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Nguyen Van A');
    await user.selectOptions(screen.getByDisplayValue('Tất cả gói'), 'PRO');

    expect(overviewSpy).toHaveBeenLastCalledWith(1, 10, undefined, 'PRO', undefined);
  });

  it('shows an empty state when there are no students', async () => {
    vi.spyOn(adminStudentService, 'getStudentOverview').mockResolvedValue(overviewOf([]));
    renderPage();

    expect(await screen.findByText('Chưa có người dùng nào.')).toBeInTheDocument();
  });

  it('shows an error message when the overview request fails', async () => {
    vi.spyOn(adminStudentService, 'getStudentOverview').mockRejectedValue(
      new Error('Failed to load student overview'),
    );
    renderPage();

    expect(await screen.findByText('Failed to load student overview')).toBeInTheDocument();
  });
});
