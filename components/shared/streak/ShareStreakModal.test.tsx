import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import ShareStreakModal from './ShareStreakModal';
import * as streakService from '../../../services/streakService';

const renderModal = (onClose = vi.fn()) =>
  render(
    <LanguageProvider>
      <ShareStreakModal
        streakId="streak-1"
        partnerName="Anna"
        partnerAvatarUrl={null}
        currentStreak={30}
        meName="Tu"
        meAvatarUrl={null}
        onClose={onClose}
      />
    </LanguageProvider>,
  );

const mockClipboard = (): { writeText: ReturnType<typeof vi.fn> } => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return { writeText };
};

const mockShare = (impl: typeof navigator.share | undefined): void => {
  Object.defineProperty(navigator, 'share', { value: impl, configurable: true });
};

beforeEach(() => {
  vi.spyOn(streakService, 'generateStreakShareLink').mockResolvedValue({ shareId: 'abc123' });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ShareStreakModal', () => {
  it('renders the split caption and the streak-count badge once the link loads', async () => {
    renderModal();

    expect(await screen.findByText(/30 days/i)).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('copies the link via the icon row', async () => {
    const user = userEvent.setup();
    const { writeText } = mockClipboard();
    renderModal();

    await screen.findByText(/30 days/i);
    await user.click(screen.getByRole('button', { name: /copy link/i }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/streak/abc123'));
    expect(await screen.findAllByText(/copied/i)).not.toHaveLength(0);
  });

  it('copies the link via the bottom copy button', async () => {
    const user = userEvent.setup();
    const { writeText } = mockClipboard();
    renderModal();

    await screen.findByText(/30 days/i);
    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/streak/abc123'));
  });

  it('links directly to the Facebook sharer with the encoded share URL', async () => {
    renderModal();
    await screen.findByText(/30 days/i);

    const link = screen.getByRole('link', { name: /facebook/i });
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('https://www.facebook.com/sharer/sharer.php?u='),
    );
    expect(decodeURIComponent(link.getAttribute('href')!)).toContain('/streak/abc123');
  });

  it('Messenger uses the native share sheet when available', async () => {
    const user = userEvent.setup();
    const share = vi.fn().mockResolvedValue(undefined);
    mockShare(share);
    renderModal();

    await screen.findByText(/30 days/i);
    await user.click(screen.getByRole('button', { name: /messenger/i }));

    await waitFor(() =>
      expect(share).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.stringContaining('/streak/abc123') }),
      ),
    );
  });

  it('Zalo falls back to copying the link when the native share sheet is unavailable', async () => {
    const user = userEvent.setup();
    mockShare(undefined);
    const { writeText } = mockClipboard();
    renderModal();

    await screen.findByText(/30 days/i);
    await user.click(screen.getByRole('button', { name: /zalo/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
  });

  it('shows an error state when link generation fails', async () => {
    vi.spyOn(streakService, 'generateStreakShareLink').mockRejectedValue(new Error('boom'));
    renderModal();

    expect(await screen.findByText(/couldn.t generate/i)).toBeInTheDocument();
  });
});
