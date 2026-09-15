import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { act, render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import CheckoutPage from './CheckoutPage';
import * as paymentService from '../../services/paymentService';
import * as userService from '../../services/userService';
import type { PaymentPresentation } from '../../services/paymentService';

const USER = { id: 'user-1', name: 'Tu', email: 't@example.com', role: 'USER' };
// Mirrors CheckoutPage's own (unexported) POLL_INTERVAL_MS.
const POLL_INTERVAL_MS = 3000;

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

const mockClipboard = (): { writeText: ReturnType<typeof vi.fn> } => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return { writeText };
};

const paymentOf = (overrides: Partial<PaymentPresentation> = {}): PaymentPresentation => ({
  paymentId: 'payment-1',
  plan: 'PRO_MONTHLY',
  amount: 199000,
  currency: 'VND',
  paymentCode: 'ENG7X9K2A4',
  status: 'PENDING',
  expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  bank: { code: 'ACB', accountNumber: '1234567890', accountName: 'NGUYEN VAN A' },
  qrUrl: 'https://img.vietqr.io/image/ACB-1234567890-compact2.png?amount=199000&addInfo=ENG7X9K2A4',
  ...overrides,
});

const renderPage = () =>
  render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={['/checkout']}>
          <Routes>
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/home" element={<p>dashboard page</p>} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </ThemeProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('accessToken', 'token-abc');
  localStorage.setItem('user', JSON.stringify(USER));
  // Safety net for every OTHER network call StudentLayout's chrome makes
  // (NotificationBell's unread count, the gamification level widget, avatar,
  // etc.) — none of them are under test here, so they all just see a 404 and
  // degrade silently, same convention as MyStreaksPage.test.tsx.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(jsonResponse(404, { message: 'Not found' }))),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  localStorage.clear();
});

describe('CheckoutPage', () => {
  it('renders the ACB bank info, transfer content and QR image', async () => {
    vi.spyOn(paymentService, 'createPayment').mockResolvedValue(paymentOf());
    renderPage();

    expect(await screen.findByText('ACB')).toBeInTheDocument();
    expect(screen.getByText('1234567890')).toBeInTheDocument();
    expect(screen.getByText('NGUYEN VAN A')).toBeInTheDocument();
    expect(screen.getByText('ENG7X9K2A4')).toBeInTheDocument();
    expect(screen.getByAltText('EngMasterAI PRO Checkout')).toHaveAttribute(
      'src',
      expect.stringContaining('img.vietqr.io'),
    );
  });

  it('formats the amount as VND', async () => {
    vi.spyOn(paymentService, 'createPayment').mockResolvedValue(paymentOf({ amount: 199000 }));
    renderPage();

    expect(await screen.findByText(/199\.000/)).toBeInTheDocument();
  });

  it('shows a pending state with an aria-live status region', async () => {
    vi.spyOn(paymentService, 'createPayment').mockResolvedValue(paymentOf());
    renderPage();

    const status = await screen.findByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent(/waiting for payment/i);
  });

  it('copying the account number and the transfer content calls the clipboard with the right values', async () => {
    vi.spyOn(paymentService, 'createPayment').mockResolvedValue(paymentOf());
    // userEvent.setup() installs its OWN clipboard stub as a side effect —
    // mockClipboard() must run AFTER it so the test's mock wins, same order
    // ShareStreakModal.test.tsx already established.
    const user = userEvent.setup();
    const { writeText } = mockClipboard();
    renderPage();

    await screen.findByText('1234567890');
    await user.click(screen.getByRole('button', { name: /copy account number/i }));
    expect(writeText).toHaveBeenCalledWith('1234567890');
    expect(await screen.findAllByText(/^copied$/i)).not.toHaveLength(0);

    await user.click(screen.getByRole('button', { name: /copy transfer content/i }));
    expect(writeText).toHaveBeenLastCalledWith('ENG7X9K2A4');
  });

  it('shows an error state and retries on demand', async () => {
    const createSpy = vi
      .spyOn(paymentService, 'createPayment')
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(paymentOf());
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('button', { name: /try again/i });
    await user.click(screen.getByRole('button', { name: /try again/i }));

    await screen.findByText('ACB');
    expect(createSpy).toHaveBeenCalledTimes(2);
  });

  it('shows the expired state and creates a new order when asked to', async () => {
    const createSpy = vi
      .spyOn(paymentService, 'createPayment')
      .mockResolvedValueOnce(paymentOf({ status: 'EXPIRED' }))
      .mockResolvedValueOnce(paymentOf({ status: 'PENDING' }));
    const user = userEvent.setup();
    renderPage();

    await screen.findByText(/this order has expired/i);
    await user.click(screen.getByRole('button', { name: /create a new order/i }));

    await screen.findByText(/waiting for payment/i);
    expect(createSpy).toHaveBeenCalledTimes(2);
  });

  it('shows a success state once PAID and navigates to the dashboard from it, never before PAID is observed', async () => {
    vi.spyOn(paymentService, 'createPayment').mockResolvedValue(paymentOf({ status: 'PAID' }));
    vi.spyOn(userService, 'getProfile').mockResolvedValue({} as never);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText(/payment successful/i);
    await user.click(screen.getByRole('button', { name: /go to dashboard/i }));

    expect(await screen.findByText('dashboard page')).toBeInTheDocument();
  });

  it('shows the already-PRO renewal notice instead of the first-time pitch', async () => {
    localStorage.setItem(
      'user',
      JSON.stringify({ ...USER, isPro: true, proExpiresAt: '2026-10-01T00:00:00.000Z' }),
    );
    vi.spyOn(paymentService, 'createPayment').mockResolvedValue(paymentOf());
    renderPage();

    expect(await screen.findByText(/you're already pro until/i)).toBeInTheDocument();
  });

  it('polls for status changes while PENDING and stops once PAID', async () => {
    vi.useFakeTimers();
    const getSpy = vi
      .spyOn(paymentService, 'getPayment')
      .mockResolvedValueOnce(paymentOf({ status: 'PENDING' }))
      .mockResolvedValueOnce(paymentOf({ status: 'PAID' }));
    vi.spyOn(paymentService, 'createPayment').mockResolvedValue(paymentOf({ status: 'PENDING' }));
    vi.spyOn(userService, 'getProfile').mockResolvedValue({} as never);
    renderPage();

    // Flushes the mocked createPayment() promise and lets React commit the
    // PENDING render + register the polling effect — waitFor's own internal
    // polling is unusable here since hard fake timers are active for the
    // whole test (no real setTimeout ticks to drive it), so every step
    // advances state via an explicit, awaited `act`.
    await act(async () => {});
    expect(screen.getByRole('status')).toHaveTextContent(/waiting for payment/i);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent(/waiting for payment/i);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(getSpy).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('status')).toHaveTextContent(/payment successful/i);

    // A third tick must NOT poll again — the status is now terminal.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    });
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  it('stops polling once the component unmounts', async () => {
    vi.useFakeTimers();
    const getSpy = vi.spyOn(paymentService, 'getPayment').mockResolvedValue(paymentOf({ status: 'PENDING' }));
    vi.spyOn(paymentService, 'createPayment').mockResolvedValue(paymentOf({ status: 'PENDING' }));
    const { unmount } = renderPage();

    await act(async () => {});
    expect(screen.getByRole('status')).toHaveTextContent(/waiting for payment/i);
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 10);
    });
    expect(getSpy).not.toHaveBeenCalled();
  });
});
