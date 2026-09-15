import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import AdminStudentDetail from './AdminStudentDetail';
import * as adminStudentService from '../../../services/adminStudentService';
import type { AdminStudentDetail as AdminStudentDetailData } from '../../../services/adminStudentService';

const ADMIN_USER = { id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: 'ADMIN' };

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

const detailOf = (overrides: Partial<AdminStudentDetailData> = {}): AdminStudentDetailData => ({
  profile: {
    id: 'student-1',
    name: 'Nguyen Van A',
    email: 'a@example.com',
    avatarUrl: null,
    level: 2,
    learningGoal: 'TOEIC_650',
    createdAt: '2026-09-01T00:00:00.000Z',
    isActive: true,
    isPro: false,
    proExpiresAt: null,
  },
  progress: {
    progressPercent: null,
    completedLessons: 0,
    totalLessons: 0,
    hasRoadmap: false,
    averageTestScore: null,
    completedTestCount: 0,
    recentTests: [],
  },
  activity: {
    totalStudySeconds: 0,
    currentStreakDays: 0,
    speakingSessionsTotal: 0,
    speakingSessionsCompleted: 0,
  },
  billing: {
    plan: null,
    isPro: false,
    proExpiresAt: null,
    payments: [],
    paymentsTotal: 0,
  },
  ...overrides,
});

const renderPage = (studentId = 'student-1') =>
  render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={[`/admin/users/${studentId}`]}>
          <Routes>
            <Route path="/admin/users/:id" element={<AdminStudentDetail />} />
            <Route path="/admin/users" element={<p>student list page</p>} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </ThemeProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('accessToken', 'token-abc');
  localStorage.setItem('user', JSON.stringify(ADMIN_USER));
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

describe('AdminStudentDetail', () => {
  it('shows safe empty states for a student with no roadmap, tests, speaking or payment data', async () => {
    vi.spyOn(adminStudentService, 'getStudentDetail').mockResolvedValue(detailOf());
    renderPage();

    expect(await screen.findByText('Chưa tạo lộ trình học')).toBeInTheDocument();
    expect(screen.getByText('Học viên chưa làm bài kiểm tra nào.')).toBeInTheDocument();
    expect(screen.getByText('Học viên chưa có giao dịch nào.')).toBeInTheDocument();
    expect(screen.getByText('0/0')).toBeInTheDocument(); // speaking sessions
  });

  it('renders payment history rows', async () => {
    vi.spyOn(adminStudentService, 'getStudentDetail').mockResolvedValue(
      detailOf({
        billing: {
          plan: 'PRO_MONTHLY',
          isPro: true,
          proExpiresAt: '2026-10-01T00:00:00.000Z',
          payments: [
            {
              paymentCode: 'ENG7X9K2A4',
              amount: 199000,
              currency: 'VND',
              status: 'PAID',
              createdAt: '2026-09-10T00:00:00.000Z',
              paidAt: '2026-09-10T00:05:00.000Z',
            },
          ],
          paymentsTotal: 1,
        },
      }),
    );
    renderPage();

    expect(await screen.findByText('ENG7X9K2A4')).toBeInTheDocument();
    expect(screen.getByText(/199\.000/)).toBeInTheDocument();
    expect(screen.getByText('Đã thanh toán')).toBeInTheDocument();
  });

  it('blocks the student after confirming the modal', async () => {
    vi.spyOn(adminStudentService, 'getStudentDetail').mockResolvedValue(detailOf());
    const statusSpy = vi
      .spyOn(adminStudentService, 'setStudentActiveStatus')
      .mockResolvedValue({ id: 'student-1', isActive: false });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /khóa tài khoản/i }));
    expect(await screen.findByText(/bạn có chắc chắn muốn khóa/i)).toBeInTheDocument();

    // Both the page trigger and the modal's confirm button read "Khóa tài
    // khoản" — the modal's is rendered last in the DOM.
    const confirmButtons = screen.getAllByRole('button', { name: /^khóa tài khoản$/i });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    expect(statusSpy).toHaveBeenCalledWith('student-1', false);
  });

  it('unblocks an already-blocked student', async () => {
    vi.spyOn(adminStudentService, 'getStudentDetail').mockResolvedValue(
      detailOf({ profile: { ...detailOf().profile, isActive: false } }),
    );
    const statusSpy = vi
      .spyOn(adminStudentService, 'setStudentActiveStatus')
      .mockResolvedValue({ id: 'student-1', isActive: true });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /mở khóa/i }));
    const confirmButtons = screen.getAllByRole('button', { name: /^mở khóa$/i });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    expect(statusSpy).toHaveBeenCalledWith('student-1', true);
  });

  it('never shows a block/unblock action when viewing your own account', async () => {
    localStorage.setItem('user', JSON.stringify({ ...ADMIN_USER, id: 'student-1' }));
    vi.spyOn(adminStudentService, 'getStudentDetail').mockResolvedValue(detailOf());
    renderPage();

    await screen.findByText('Nguyen Van A');
    expect(screen.queryByRole('button', { name: /khóa tài khoản/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mở khóa/i })).not.toBeInTheDocument();
  });

  it('shows an error state with retry when the detail request fails', async () => {
    const detailSpy = vi
      .spyOn(adminStudentService, 'getStudentDetail')
      .mockRejectedValueOnce(new Error('Failed to load student detail'))
      .mockResolvedValueOnce(detailOf());
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Failed to load student detail');
    await user.click(screen.getByRole('button', { name: /thử lại/i }));

    await screen.findByText('Nguyen Van A');
    expect(detailSpy).toHaveBeenCalledTimes(2);
  });
});
