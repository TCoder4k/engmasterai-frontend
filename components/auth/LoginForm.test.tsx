import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginForm } from './LoginForm';

// Real component logic + real authService/apiFetch stack, with only
// `fetch` mocked at the network boundary — this is deliberately an
// integration-style test (not a shallow unit test) so it exercises the
// exact same event-bubbling/DOM structure a real browser would, which is
// what actually caught the nested-<form> regression this test guards
// against: a shallow test that stubs authService entirely wouldn't have
// reproduced the bug, since the bug was in how the two <form> elements
// were nested in the DOM, not in what authService itself does.
vi.mock('./GoogleSignInButton', () => ({
  GoogleSignInButton: ({ onCredential }: { onCredential: (c: string) => void }) => (
    <button onClick={() => onCredential('fake-google-credential')}>
      Mock Continue with Google
    </button>
  ),
}));

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

const ACCOUNT_LINK_REQUIRED_BODY = {
  statusCode: 409,
  code: 'ACCOUNT_LINK_REQUIRED',
  message: 'An account already exists with this email. Log in with your password to link Google.',
  email: 'tucaqn1@gmail.com',
};

describe('LoginForm — Google account-link flow', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    navigateMock.mockClear();
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const renderAndTriggerLinkRequired = async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(409, ACCOUNT_LINK_REQUIRED_BODY));
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByText('Mock Continue with Google'));
    expect(await screen.findByText(/đã tồn tại/)).toBeInTheDocument();
  };

  it('409 ACCOUNT_LINK_REQUIRED opens the password-linking UI', async () => {
    await renderAndTriggerLinkRequired();
    expect(screen.getByPlaceholderText('Mật khẩu hiện tại')).toBeInTheDocument();
    expect(screen.getByText('Liên kết tài khoản')).toBeInTheDocument();
  });

  it('renders exactly one <form> element while the linking UI is shown (no nested forms)', async () => {
    const { container } = await (async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(409, ACCOUNT_LINK_REQUIRED_BODY));
      const utils = render(
        <MemoryRouter>
          <LoginForm />
        </MemoryRouter>,
      );
      await userEvent.click(screen.getByText('Mock Continue with Google'));
      await screen.findByText(/đã tồn tại/);
      return utils;
    })();

    expect(container.querySelectorAll('form')).toHaveLength(1);
  });

  it('wrong password shows a visible, safe error and does not invoke global logout or redirect', async () => {
    await renderAndTriggerLinkRequired();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { statusCode: 403, message: 'Invalid credentials' }),
    );

    await userEvent.type(screen.getByPlaceholderText('Mật khẩu hiện tại'), 'wrong-password');
    await userEvent.click(screen.getByText('Liên kết tài khoản'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Mật khẩu không chính xác.');
    // No forced logout/redirect on a wrong password — the user must still
    // be able to retry from the same linking form.
    expect(navigateMock).not.toHaveBeenCalledWith('/login');
    expect(localStorage.getItem('accessToken')).toBeNull();
    // The linking UI must still be showing (not bounced back to the plain
    // login form) so the user can immediately retry.
    expect(screen.getByPlaceholderText('Mật khẩu hiện tại')).toBeInTheDocument();
  });

  it('submitting the linking form does not trigger a native page reload (preventDefault took effect)', async () => {
    await renderAndTriggerLinkRequired();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { statusCode: 403, message: 'Invalid credentials' }),
    );
    const beforeUrl = window.location.href;

    await userEvent.type(screen.getByPlaceholderText('Mật khẩu hiện tại'), 'wrong-password');
    await userEvent.click(screen.getByText('Liên kết tài khoản'));
    await screen.findByRole('alert');

    expect(window.location.href).toBe(beforeUrl);
    // Exactly one /auth/google/link call — proves the outer login form's
    // onSubmit did NOT also fire (the nested-form regression would have
    // caused a second, unrelated /auth/login call here).
    const linkCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/auth/google/link'),
    );
    const loginCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/login'));
    expect(linkCalls).toHaveLength(1);
    expect(loginCalls).toHaveLength(0);
  });

  it('correct password persists the session via the canonical path, updates auth state, and redirects to /home', async () => {
    await renderAndTriggerLinkRequired();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        message: 'Google account linked and signed in successfully',
        user: {
          id: 'user-1',
          name: 'Tu',
          email: 'tucaqn1@gmail.com',
          role: 'USER',
          emailVerified: true,
        },
        accessToken: 'issued.access.token',
      }),
    );
    // enterSession()'s best-effort getProfile() call.
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        id: 'user-1',
        name: 'Tu',
        email: 'tucaqn1@gmail.com',
        avatarUrl: null,
        role: 'USER',
        totalPoints: 0,
        level: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        emailVerified: true,
      }),
    );

    const authChangedHandler = vi.fn();
    window.addEventListener('emai:auth-changed', authChangedHandler);

    await userEvent.type(screen.getByPlaceholderText('Mật khẩu hiện tại'), 'correct-password');
    await userEvent.click(screen.getByText('Liên kết tài khoản'));

    // Canonical persistence path (authService.saveAuth) — same localStorage
    // keys every other session-issuing flow (login/register/googleLogin)
    // uses; no second/parallel storage mechanism.
    await waitFor(() => expect(localStorage.getItem('accessToken')).toBe('issued.access.token'));
    expect(JSON.parse(localStorage.getItem('user') ?? '{}')).toMatchObject({
      id: 'user-1',
      email: 'tucaqn1@gmail.com',
    });
    // Auth-change notification dispatched (same event every other
    // sign-in path fires — ThemeProvider/other listeners react to this).
    expect(authChangedHandler).toHaveBeenCalled();
    // Navigates to the authenticated home route.
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/home'));

    window.removeEventListener('emai:auth-changed', authChangedHandler);
  });

  it('a rate-limited (429) attempt shows a distinct, non-generic message', async () => {
    await renderAndTriggerLinkRequired();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(429, { statusCode: 429, message: 'Too many requests. Please try again later.' }),
    );

    await userEvent.type(screen.getByPlaceholderText('Mật khẩu hiện tại'), 'anything');
    await userEvent.click(screen.getByText('Liên kết tài khoản'));

    expect(await screen.findByRole('alert')).toHaveTextContent('quá nhiều lần');
  });

  it('a network failure shows a generic, non-crashing error message', async () => {
    await renderAndTriggerLinkRequired();
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await userEvent.type(screen.getByPlaceholderText('Mật khẩu hiện tại'), 'anything');
    await userEvent.click(screen.getByText('Liên kết tài khoản'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể kết nối máy chủ');
  });

  it('an expired/invalid Google credential (401) shows a Google-specific message, not a session-expired one', async () => {
    await renderAndTriggerLinkRequired();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { statusCode: 401, message: 'Google sign-in failed' }),
    );

    await userEvent.type(screen.getByPlaceholderText('Mật khẩu hiện tại'), 'anything');
    await userEvent.click(screen.getByText('Liên kết tài khoản'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Phiên xác thực Google đã hết hạn');
    expect(navigateMock).not.toHaveBeenCalledWith('/login');
    expect(localStorage.getItem('accessToken')).toBeNull();
  });
});
