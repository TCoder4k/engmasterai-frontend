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
  author: { id: 'other-1', name: 'Anna', avatarUrl: null, level: 5, isAdmin: false },
};

const renderBubble = (isOwn: boolean, overrideMessage: CommunityMessage = message) =>
  render(
    <LanguageProvider>
      <MemoryRouter>
        <CommunityMessageBubble message={overrideMessage} isOwn={isOwn} />
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

describe('CommunityMessageBubble — admin announcement', () => {
  const adminMessage: CommunityMessage = {
    ...message,
    content: 'Chào mừng mọi người đến với cộng đồng! https://example.com/group',
    author: { id: 'admin-1', name: 'Admin EngMaster', avatarUrl: null, level: 1, isAdmin: true },
  };

  it('renders the ADMIN badge, the author name, and the message — not the ordinary avatar/bubble treatment', () => {
    renderBubble(false, adminMessage);

    expect(screen.getByText('Admin EngMaster')).toBeInTheDocument();
    expect(screen.getByText('ADMIN')).toBeInTheDocument();
    expect(screen.getByText(/Chào mừng mọi người/)).toBeInTheDocument();
    // No Streak Together entry point on an announcement — it isn't an
    // ordinary user message with a clickable avatar/name.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('still auto-links a URL inside the announcement text', () => {
    renderBubble(false, adminMessage);

    const link = screen.getByRole('link', { name: 'https://example.com/group' });
    expect(link).toHaveAttribute('href', 'https://example.com/group');
  });

  it('takes priority over isOwn — an admin viewing their own announcement still sees the announcement style, not the blue own-message bubble', () => {
    renderBubble(true, adminMessage);

    expect(screen.getByText('ADMIN')).toBeInTheDocument();
    expect(screen.getByText('Admin EngMaster')).toBeInTheDocument();
  });

  it('a non-admin message never shows the ADMIN badge', () => {
    renderBubble(false);
    expect(screen.queryByText('ADMIN')).not.toBeInTheDocument();
  });
});
