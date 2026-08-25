import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { RegisterForm as RegisterFormComponent } from './RegisterForm';
import type * as TurnstileModule from '../../services/turnstileWidget';
import { LanguageProvider } from '../../i18n/LanguageProvider';

// Same reasoning as TurnstileWidget.test.tsx / GoogleSignInButton.test.tsx:
// RegisterForm reads TURNSTILE_SITE_KEY at module-import time to decide the
// submit button's disabled condition, so the env var must be stubbed BEFORE
// any static import — kept in its own file (separate from RegisterForm.test.tsx,
// which deliberately exercises the default unconfigured-widget state) so
// the two configurations never share one module instance.
vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-site-key');

let RegisterForm: typeof RegisterFormComponent;
let turnstileService: typeof TurnstileModule;

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

let capturedCallback: ((token: string) => void) | undefined;

const fillOutForm = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByPlaceholderText('Nguyễn Văn A'), 'Tu');
  await user.type(screen.getByPlaceholderText('example@gmail.com'), 'tu@example.com');
  const [password, confirmPassword] = screen.getAllByPlaceholderText('••••••••');
  await user.type(password, 'correct-password');
  await user.type(confirmPassword, 'correct-password');
  await user.click(screen.getByRole('checkbox'));
};

describe('RegisterForm — Turnstile CAPTCHA gate', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    ({ RegisterForm } = await import('./RegisterForm'));
    turnstileService = await import('../../services/turnstileWidget');
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    localStorage.clear();
    navigateMock.mockClear();
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    capturedCallback = undefined;
    vi.spyOn(turnstileService, 'renderTurnstile').mockImplementation(
      async (_container, _sitekey, options) => {
        capturedCallback = options.callback;
        return 'widget-1';
      },
    );
    vi.spyOn(turnstileService, 'resetTurnstile').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const renderForm = () =>
    render(
      <LanguageProvider>
        <MemoryRouter>
          <RegisterForm />
        </MemoryRouter>
      </LanguageProvider>,
    );

  it('keeps submit disabled until the widget produces a token', async () => {
    const user = userEvent.setup();
    renderForm();
    await act(async () => {});
    await fillOutForm(user);

    expect(screen.getByText('ĐĂNG KÝ NGAY')).toBeDisabled();

    act(() => capturedCallback?.('solved-token'));

    expect(screen.getByText('ĐĂNG KÝ NGAY')).not.toBeDisabled();
  }, 15000);

  it('includes the solved token in the register() request payload', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        user: { id: 'user-1', name: 'Tu', email: 'tu@example.com', role: 'USER', emailVerified: false },
        accessToken: 'issued.access.token',
        emailDeliveryStatus: 'sent',
      }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        id: 'user-1', name: 'Tu', email: 'tu@example.com', avatarUrl: null, role: 'USER',
        totalPoints: 0, level: 1, createdAt: '2026-01-01T00:00:00.000Z', emailVerified: false,
      }),
    );
    const user = userEvent.setup();
    renderForm();
    await act(async () => {});
    await fillOutForm(user);
    act(() => capturedCallback?.('solved-token'));

    await user.click(screen.getByText('ĐĂNG KÝ NGAY'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const registerCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/auth/register'),
    );
    const body = JSON.parse((registerCall?.[1] as RequestInit).body as string);
    expect(body.captchaToken).toBe('solved-token');
  }, 15000);

  it('resets the widget and clears the token after a failed register response, disabling submit again', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { statusCode: 400, message: 'CAPTCHA verification failed. Please try again.' }),
    );
    const user = userEvent.setup();
    renderForm();
    await act(async () => {});
    await fillOutForm(user);
    act(() => capturedCallback?.('solved-token'));

    await user.click(screen.getByText('ĐĂNG KÝ NGAY'));

    await waitFor(() =>
      expect(screen.getByText('CAPTCHA verification failed. Please try again.')).toBeInTheDocument(),
    );
    expect(turnstileService.resetTurnstile).toHaveBeenCalledWith('widget-1');
    expect(screen.getByText('ĐĂNG KÝ NGAY')).toBeDisabled();
  }, 15000);
});
