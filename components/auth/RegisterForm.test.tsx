import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RegisterForm } from './RegisterForm';

// See LoginForm.test.tsx for why this is an integration-style test (real
// authService/apiFetch stack, only `fetch` mocked) rather than a shallow
// unit test — that's what actually reproduces the nested-<form> regression
// this test guards against.
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

describe('RegisterForm — Google account-link flow', () => {
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
        <RegisterForm />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByText('Mock Continue with Google'));
    expect(await screen.findByText(/đã tồn tại/)).toBeInTheDocument();
  };

  it('409 ACCOUNT_LINK_REQUIRED opens the password-linking UI and renders exactly one <form>', async () => {
    const { container } = await (async () => {
      const utils = render(
        <MemoryRouter>
          <RegisterForm />
        </MemoryRouter>,
      );
      fetchMock.mockResolvedValueOnce(jsonResponse(409, ACCOUNT_LINK_REQUIRED_BODY));
      await userEvent.click(screen.getByText('Mock Continue with Google'));
      await screen.findByText(/đã tồn tại/);
      return utils;
    })();

    expect(screen.getByPlaceholderText('Mật khẩu hiện tại')).toBeInTheDocument();
    expect(container.querySelectorAll('form')).toHaveLength(1);
  });

  it('wrong password shows a visible, safe error, does not clear auth state, and does not redirect', async () => {
    await renderAndTriggerLinkRequired();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { statusCode: 403, message: 'Invalid credentials' }),
    );

    await userEvent.type(screen.getByPlaceholderText('Mật khẩu hiện tại'), 'wrong-password');
    await userEvent.click(screen.getByText('Liên kết tài khoản'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Mật khẩu không chính xác.');
    expect(navigateMock).not.toHaveBeenCalledWith('/login');
    expect(localStorage.getItem('accessToken')).toBeNull();
    // No unrelated /auth/register call fired (would indicate the outer
    // register <form>'s onSubmit also fired via the nested-form bug).
    const registerCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith('/auth/register'),
    );
    expect(registerCalls).toHaveLength(0);
  });

  it('correct password persists the session canonically and redirects to /home', async () => {
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

    await userEvent.type(screen.getByPlaceholderText('Mật khẩu hiện tại'), 'correct-password');
    await userEvent.click(screen.getByText('Liên kết tài khoản'));

    await waitFor(() => expect(localStorage.getItem('accessToken')).toBe('issued.access.token'));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/home'));
  });

  it('a rate-limited (429) attempt shows a distinct message and preserves the linking form', async () => {
    await renderAndTriggerLinkRequired();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(429, { statusCode: 429, message: 'Too many requests. Please try again later.' }),
    );

    await userEvent.type(screen.getByPlaceholderText('Mật khẩu hiện tại'), 'anything');
    await userEvent.click(screen.getByText('Liên kết tài khoản'));

    expect(await screen.findByRole('alert')).toHaveTextContent('quá nhiều lần');
    expect(screen.getByPlaceholderText('Mật khẩu hiện tại')).toBeInTheDocument();
  });
});
