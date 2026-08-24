import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../../../i18n/LanguageProvider';
import CommunityMessageBubble from './CommunityMessageBubble';
import * as streakService from '../../../../services/streakService';
import type { CommunityMessage } from '../../../../services/communityChatService';

const message: CommunityMessage = {
  id: 'm1',
  content: 'hello',
  clientMessageId: 'c1',
  createdAt: new Date().toISOString(),
  author: { id: 'other-1', name: 'Anna', avatarUrl: null, level: 5 },
};

const renderBubble = (isOwn: boolean) =>
  render(
    <LanguageProvider>
      <MemoryRouter>
        <CommunityMessageBubble message={message} isOwn={isOwn} />
      </MemoryRouter>
    </LanguageProvider>,
  );

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CommunityMessageBubble — Streak Together entry point', () => {
  it('clicking another user’s name opens the streak entry popover', async () => {
    vi.spyOn(streakService, 'getStreakPairStatus').mockResolvedValue({ relationship: 'none' });
    const user = userEvent.setup();
    renderBubble(false);

    await user.click(screen.getByRole('button', { name: '@Anna' }));

    expect(await screen.findByRole('button', { name: /keep a streak together/i })).toBeInTheDocument();
  });

  it('clicking the avatar also opens the popover', async () => {
    vi.spyOn(streakService, 'getStreakPairStatus').mockResolvedValue({ relationship: 'none' });
    const user = userEvent.setup();
    renderBubble(false);

    // The avatar button has no accessible name of its own (its image is
    // aria-hidden) — it's the first of the two clickable controls in the
    // bubble header.
    const buttons = screen.getAllByRole('button');
    await user.click(buttons[0]);

    expect(await screen.findByRole('button', { name: /keep a streak together/i })).toBeInTheDocument();
  });

  it('an own message renders no clickable avatar/name at all', () => {
    renderBubble(true);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
