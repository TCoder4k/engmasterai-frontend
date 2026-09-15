import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { createPayment, getPayment, PaymentPresentation } from './paymentService';

const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

const paymentOf = (overrides: Partial<PaymentPresentation> = {}): PaymentPresentation => ({
  paymentId: 'payment-1',
  plan: 'PRO_MONTHLY',
  amount: 199000,
  currency: 'VND',
  paymentCode: 'ENG7X9K2A4',
  status: 'PENDING',
  expiresAt: '2026-09-15T10:15:00.000Z',
  bank: { code: 'ACB', accountNumber: '1234567890', accountName: 'NGUYEN VAN A' },
  qrUrl: 'https://img.vietqr.io/image/ACB-1234567890-compact2.png',
  ...overrides,
});

beforeEach(() => {
  localStorage.setItem('accessToken', 'token-abc');
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('createPayment', () => {
  it('POSTs only { plan } — never a client-chosen amount — and returns the parsed presentation', async () => {
    const payment = paymentOf();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, payment));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await createPayment('PRO_MONTHLY');

    expect(result).toEqual(payment);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/payments');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ plan: 'PRO_MONTHLY' });
  });

  it('throws on a failed response', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(429, { message: 'Too many requests' })) as unknown as typeof fetch;

    await expect(createPayment('PRO_MONTHLY')).rejects.toThrow('Too many requests');
  });
});

describe('getPayment', () => {
  it('GETs /payments/:id and returns the parsed presentation', async () => {
    const payment = paymentOf({ status: 'PAID' });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, payment));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await getPayment('payment-1');

    expect(result).toEqual(payment);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/payments/payment-1');
  });

  it('throws on a 404 (e.g. another user\'s payment)', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(404, { message: 'Payment not found' })) as unknown as typeof fetch;

    await expect(getPayment('someone-elses-id')).rejects.toThrow('Payment not found');
  });
});
