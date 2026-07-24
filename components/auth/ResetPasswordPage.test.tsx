import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ResetPasswordPage } from './ResetPasswordPage';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

const renderWithToken = (token: string | null = 'a-valid-reset-token') =>
  render(
    <MemoryRouter
      initialEntries={[token ? `/reset-password?token=${token}` : '/reset-password']}
    >
      <ResetPasswordPage />
    </MemoryRouter>,
  );

describe('ResetPasswordPage', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    navigateMock.mockClear();
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows the invalid-link state immediately when no token is present in the URL — no request fired', () => {
    renderWithToken(null);

    expect(
      screen.getByText('Liên kết không hợp lệ hoặc đã hết hạn.'),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('client-side rejects a too-short password before ever calling the backend', async () => {
    renderWithToken();

    const [newPasswordInput, confirmInput] = screen.getAllByPlaceholderText('••••••••');
    await userEvent.type(newPasswordInput, 'abc');
    await userEvent.type(confirmInput, 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('ít nhất 6 ký tự');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('client-side rejects mismatched password confirmation before calling the backend', async () => {
    renderWithToken();

    const [newPasswordInput, confirmInput] = screen.getAllByPlaceholderText('••••••••');
    await userEvent.type(newPasswordInput, 'password-one');
    await userEvent.type(confirmInput, 'password-two');
    await userEvent.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('không khớp');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('submits the token and new password to POST /auth/password/reset, and shows the success state on 200', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, {
        message: 'Password has been reset successfully. Please log in with your new password.',
      }),
    );
    renderWithToken('a-valid-reset-token');

    const [newPasswordInput, confirmInput] = screen.getAllByPlaceholderText('••••••••');
    await userEvent.type(newPasswordInput, 'brand-new-password');
    await userEvent.type(confirmInput, 'brand-new-password');
    await userEvent.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));

    expect(await screen.findByText('Đặt lại mật khẩu thành công!')).toBeInTheDocument();

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/password/reset');
    expect(JSON.parse(options.body as string)).toEqual({
      token: 'a-valid-reset-token',
      newPassword: 'brand-new-password',
    });
    // Token stripped from the visible URL/history after success.
    expect(navigateMock).toHaveBeenCalledWith('/reset-password', { replace: true });
    // No session is issued by this endpoint — nothing persisted locally.
    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('a 409 PASSWORD_REUSE response shows a specific message, clears the password fields, and does NOT treat the link as invalid (token still usable)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, {
        statusCode: 409,
        code: 'PASSWORD_REUSE',
        message: 'New password must differ from your current password.',
      }),
    );
    renderWithToken();

    const [newPasswordInput, confirmInput] = screen.getAllByPlaceholderText('••••••••');
    await userEvent.type(newPasswordInput, 'current-password');
    await userEvent.type(confirmInput, 'current-password');
    await userEvent.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'không được trùng với mật khẩu hiện tại',
    );
    // The form (not the invalid-link state) is still showing — the token
    // was not consumed, so the user can retry immediately.
    expect(screen.getByText('Đặt lại mật khẩu', { selector: 'h1' })).toBeInTheDocument();
    const [clearedNewPassword, clearedConfirm] = screen.getAllByPlaceholderText('••••••••');
    expect(clearedNewPassword).toHaveValue('');
    expect(clearedConfirm).toHaveValue('');
  });

  it('a 400 response (invalid/expired token) switches to the invalid-link state', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { statusCode: 400, message: 'Invalid or expired reset link.' }),
    );
    renderWithToken();

    const [newPasswordInput, confirmInput] = screen.getAllByPlaceholderText('••••••••');
    await userEvent.type(newPasswordInput, 'brand-new-password');
    await userEvent.type(confirmInput, 'brand-new-password');
    await userEvent.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));

    expect(
      await screen.findByText('Liên kết không hợp lệ hoặc đã hết hạn.'),
    ).toBeInTheDocument();
  });

  it('a rate-limited (429) attempt shows a distinct message and keeps the form usable', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(429, { statusCode: 429, message: 'Too many requests. Please try again later.' }),
    );
    renderWithToken();

    const [newPasswordInput, confirmInput] = screen.getAllByPlaceholderText('••••••••');
    await userEvent.type(newPasswordInput, 'brand-new-password');
    await userEvent.type(confirmInput, 'brand-new-password');
    await userEvent.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('quá nhiều lần');
  });

  it('a network failure shows a generic, non-crashing error message', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderWithToken();

    const [newPasswordInput, confirmInput] = screen.getAllByPlaceholderText('••••••••');
    await userEvent.type(newPasswordInput, 'brand-new-password');
    await userEvent.type(confirmInput, 'brand-new-password');
    await userEvent.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể kết nối máy chủ');
  });
});
