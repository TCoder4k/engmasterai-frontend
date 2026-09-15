import { throwApiError } from './apiError';
import { apiFetch } from './apiFetch';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export type SubscriptionPlan = 'PRO_MONTHLY';

// EXPIRED never exists in the database — it's the backend's read-time
// projection of a PENDING row past its expiresAt (see PaymentService.toDto).
// A late webhook can still settle a payment shown as EXPIRED here.
export type PaymentPresentationStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'REFUNDED';

export interface PaymentPresentation {
  paymentId: string;
  plan: SubscriptionPlan;
  amount: number;
  currency: string;
  paymentCode: string;
  status: PaymentPresentationStatus;
  expiresAt: string;
  bank: {
    code: string;
    accountNumber: string;
    accountName: string;
  };
  qrUrl: string;
}

// POST /payments — the server alone decides the price (see backend
// CreatePaymentDto, which has no amount field at all). Returns the same
// order (200) if a live one already exists for this user+plan, or a new one
// (201) otherwise — see PaymentService.createOrReusePayment.
export const createPayment = async (plan: SubscriptionPlan): Promise<PaymentPresentation> => {
  const response = await apiFetch(`${API_BASE_URL}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  });

  if (!response.ok) return throwApiError(response, 'Failed to create payment');
  return response.json();
};

// GET /payments/:id — owner-only. Polled by CheckoutPage while PENDING.
export const getPayment = async (paymentId: string): Promise<PaymentPresentation> => {
  const response = await apiFetch(`${API_BASE_URL}/payments/${paymentId}`);

  if (!response.ok) return throwApiError(response, 'Failed to load payment status');
  return response.json();
};
