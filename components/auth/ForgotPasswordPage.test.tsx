import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ForgotPasswordPage } from './ForgotPasswordPage';

// Real component logic + real authService/fetchWithTimeout stack, only
// `fetch` mocked — same integration-style convention as LoginForm.test.tsx.
const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

// The backend's own generic response body — used only to populate a
// realistic mock; the component does not render this string directly (it
// shows its own static localized copy on success, see RENDERED_SUCCESS_TEXT).
const BACKEND_MESSAGE =
  'If an account exists for this email, a password reset link has been sent.';
const RENDERED_SUCCESS_TEXT =
  'Nếu tài khoản tồn tại, chúng tôi đã gửi email đặt lại mật khẩu.';

describe('ForgotPasswordPage', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );

  it('shows the same generic success message for a well-formed submission, regardless of what the backend actually did', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, { message: BACKEND_MESSAGE }),
    );
    renderPage();

    await userEvent.type(screen.getByPlaceholderText('ten-dang-nhap@gmail.com'), 'someone@example.com');
    await userEvent.click(screen.getByText('Gửi liên kết đặt lại mật khẩu'));

    expect(await screen.findByText(RENDERED_SUCCESS_TEXT)).toBeInTheDocument();
  });

  it('sends the submitted email to POST /auth/password/forgot', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, { message: BACKEND_MESSAGE }),
    );
    renderPage();

    await userEvent.type(screen.getByPlaceholderText('ten-dang-nhap@gmail.com'), 'someone@example.com');
    await userEvent.click(screen.getByText('Gửi liên kết đặt lại mật khẩu'));
    await screen.findByText(RENDERED_SUCCESS_TEXT);

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/password/forgot');
    expect(JSON.parse(options.body as string)).toEqual({
      email: 'someone@example.com',
    });
  });

  it('does not cause a native page reload on submit (preventDefault took effect)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, { message: BACKEND_MESSAGE }),
    );
    renderPage();
    const beforeUrl = window.location.href;

    await userEvent.type(screen.getByPlaceholderText('ten-dang-nhap@gmail.com'), 'someone@example.com');
    await userEvent.click(screen.getByText('Gửi liên kết đặt lại mật khẩu'));
    await screen.findByText(RENDERED_SUCCESS_TEXT);

    expect(window.location.href).toBe(beforeUrl);
  });

  it('a rate-limited (429) attempt shows a distinct message and keeps the form visible for a retry', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(429, { statusCode: 429, message: 'Too many requests. Please try again later.' }),
    );
    renderPage();

    await userEvent.type(screen.getByPlaceholderText('ten-dang-nhap@gmail.com'), 'someone@example.com');
    await userEvent.click(screen.getByText('Gửi liên kết đặt lại mật khẩu'));

    expect(await screen.findByRole('alert')).toHaveTextContent('quá nhiều lần');
    expect(screen.getByPlaceholderText('ten-dang-nhap@gmail.com')).toBeInTheDocument();
  });

  it('a network failure shows a generic, non-crashing error message', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderPage();

    await userEvent.type(screen.getByPlaceholderText('ten-dang-nhap@gmail.com'), 'someone@example.com');
    await userEvent.click(screen.getByText('Gửi liên kết đặt lại mật khẩu'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể kết nối máy chủ');
  });

  it('disables the submit button while the request is in flight (duplicate-submit guard)', async () => {
    let resolveFetch: (value: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    renderPage();

    await userEvent.type(screen.getByPlaceholderText('ten-dang-nhap@gmail.com'), 'someone@example.com');
    const submitButton = screen.getByRole('button');
    await userEvent.click(submitButton);

    expect(submitButton).toBeDisabled();
    resolveFetch!(jsonResponse(201, { message: BACKEND_MESSAGE }));
    await screen.findByText(RENDERED_SUCCESS_TEXT);
  });
});
