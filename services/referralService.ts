import { throwApiError } from './apiError';
import { apiFetch } from './apiFetch';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// 2026-09-16 pricing relaunch (Phase C) — "Mời một người bạn học thật → cả
// hai nhận 3 ngày PRO". Distinct from Streak Together's own invite-link
// service (that one pairs two people for a shared streak; this is a
// one-time mutual PRO-days reward).

// GET /referrals/my-code — lazily generates-or-returns the caller's own code.
export const getMyReferralCode = async (): Promise<{ code: string }> => {
  const response = await apiFetch(`${API_BASE_URL}/referrals/my-code`);
  if (!response.ok) return throwApiError(response, 'Failed to load your referral code');
  return response.json();
};

// POST /referrals/redeem — 204 on success. 400 for your own code, 404 for an
// unknown code, 409 (code: undefined message) if already redeemed once.
export const redeemReferralCode = async (code: string): Promise<void> => {
  const response = await apiFetch(`${API_BASE_URL}/referrals/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!response.ok) return throwApiError(response, 'Failed to redeem this code');
};
