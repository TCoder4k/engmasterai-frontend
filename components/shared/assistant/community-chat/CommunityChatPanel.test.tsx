import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from '../../../../i18n/LanguageProvider';
import AssistantBoundary from '../AssistantBoundary';
import * as chatService from '../../../../services/chatService';
import * as communityChatService from '../../../../services/communityChatService';
import * as communityChatSocket from '../../../../services/communityChatSocket';
import type { CommunityChatSocketHandlers } from '../../../../services/communityChatSocket';
import type { CommunityMessage } from '../../../../services/communityChatService';
import { ApiError } from '../../../../services/apiError';

// Community Chat's own test file, kept separate from the existing
// AssistantBoundary.test.tsx (1000+ lines already) — new mocking machinery
// for the WS client and scroll behaviour would meaningfully grow an
// already-large file. Still driven end to end through the real boundary,
// same rationale that file already gives for its own approach.

const renderBoundary = () =>
  render(
    <LanguageProvider>
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route element={<AssistantBoundary />}>
            <Route path="/home" element={<p>page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );

const chatLauncher = () => screen.queryByRole('button', { name: /engy/i });
const openChat = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(chatLauncher()!);
};
const switchToCommunity = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('tab', { name: /community/i }));
};
const switchToEngy = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('tab', { name: /engy ai/i }));
};
const communityComposer = () => screen.getByRole('textbox', { name: /message the community/i });
const communitySendButton = () => screen.getByRole('button', { name: /^send$/i });
const openCommunity = async (user: ReturnType<typeof userEvent.setup>) => {
  await openChat(user);
  await switchToCommunity(user);
  await waitFor(() => expect(screen.getByRole('log')).toBeInTheDocument());
};

const makeMessage = (overrides: Partial<CommunityMessage> = {}): CommunityMessage => ({
  id: 'm1',
  content: 'hello',
  clientMessageId: 'client-1',
  createdAt: new Date().toISOString(),
  author: { id: 'other-user', name: 'Alice', avatarUrl: null, level: 5, isAdmin: false },
  ...overrides,
});

let capturedHandlers: CommunityChatSocketHandlers | null = null;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  // Safe default so opening Engy in a test that isn't ABOUT it never hits a
  // real network call — same convention AssistantBoundary.test.tsx uses.
  vi.spyOn(chatService, 'getChatSession').mockResolvedValue({ turns: [], expiresAt: null });

  vi.spyOn(communityChatService, 'listCommunityMessages').mockResolvedValue({
    data: [],
    meta: { hasMore: false, oldestId: null },
  });
  vi.spyOn(communityChatService, 'issueCommunityLiveTicket').mockResolvedValue({ ticket: 'test-ticket' });
  // AssistantBoundary polls this on mount regardless of which tab a test
  // cares about; CommunityChatPanel also calls markCommunityMessagesRead on
  // tab activation — both safe defaults so a test that isn't ABOUT the
  // unread badge never hits a real network call.
  vi.spyOn(communityChatService, 'getUnreadCommunityMessageCount').mockResolvedValue(0);
  vi.spyOn(communityChatService, 'markCommunityMessagesRead').mockResolvedValue(undefined);
  vi.spyOn(communityChatSocket, 'connectCommunityLive').mockImplementation((_ticket, handlers) => {
    capturedHandlers = handlers;
    return { close: vi.fn() };
  });

  localStorage.setItem(
    'user',
    JSON.stringify({ id: 'me', name: 'Me', email: 'me@test.com', role: 'USER', emailVerified: true }),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.removeItem('user');
  capturedHandlers = null;
});

describe('CommunityChatPanel — tabs', () => {
  it('switches from Engy to Community without unmounting Engy, preserving an in-progress draft', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openChat(user);
    await user.type(screen.getByRole('textbox', { name: /message engy/i }), 'draft text');

    await switchToCommunity(user);
    expect(screen.getByRole('dialog', { name: 'Community Chat' })).toBeInTheDocument();
    // Hidden via the native `hidden` attribute, not unmounted — but excluded
    // from accessibility queries either way, so this must resolve to none.
    expect(screen.queryByRole('textbox', { name: /message engy/i })).not.toBeInTheDocument();
    // Exactly one "Send" button resolves — Engy's own is excluded from the
    // accessibility tree while hidden, not just visually offscreen.
    expect(screen.getAllByRole('button', { name: /^send$/i })).toHaveLength(1);

    await switchToEngy(user);
    expect(screen.getByRole('dialog', { name: 'Engy' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /message engy/i })).toHaveValue('draft text');
  });

  it('renders only the "All" filter chip', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openCommunity(user);

    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.queryByText(/hot/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/friends/i)).not.toBeInTheDocument();
  });
});

describe('CommunityChatPanel — loading states', () => {
  it('shows the empty state when there are no messages', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openCommunity(user);

    await waitFor(() => expect(screen.getByText(/no messages yet/i)).toBeInTheDocument());
  });

  it('shows an error state with a working retry when the initial fetch fails', async () => {
    vi.spyOn(communityChatService, 'listCommunityMessages').mockRejectedValueOnce(new Error('down'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openCommunity(user);

    await waitFor(() => expect(screen.getByText(/couldn't load community messages/i)).toBeInTheDocument());

    vi.spyOn(communityChatService, 'listCommunityMessages').mockResolvedValueOnce({
      data: [],
      meta: { hasMore: false, oldestId: null },
    });
    await user.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(screen.getByText(/no messages yet/i)).toBeInTheDocument());
  });
});

describe('CommunityChatPanel — rendering', () => {
  it('renders a fetched message with author name, level, and content', async () => {
    vi.spyOn(communityChatService, 'listCommunityMessages').mockResolvedValue({
      data: [makeMessage({ content: 'hello everyone', author: { id: 'other', name: 'Alice', avatarUrl: null, level: 7, isAdmin: false } })],
      meta: { hasMore: false, oldestId: 'm1' },
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openCommunity(user);

    await waitFor(() => expect(screen.getByText('hello everyone')).toBeInTheDocument());
    expect(screen.getByText('@Alice')).toBeInTheDocument();
    expect(screen.getByText('Lv.7')).toBeInTheDocument();
  });

  it("does not show an @name/level header on the current user's own messages", async () => {
    vi.spyOn(communityChatService, 'listCommunityMessages').mockResolvedValue({
      data: [
        makeMessage({ id: 'm1', clientMessageId: 'c1', content: 'my own message', author: { id: 'me', name: 'Me', avatarUrl: null, level: 3, isAdmin: false } }),
        makeMessage({ id: 'm2', clientMessageId: 'c2', content: "someone else's message", author: { id: 'bob', name: 'Bob', avatarUrl: null, level: 2, isAdmin: false } }),
      ],
      meta: { hasMore: false, oldestId: 'm1' },
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openCommunity(user);

    await waitFor(() => expect(screen.getByText('my own message')).toBeInTheDocument());
    expect(screen.queryByText('@Me')).not.toBeInTheDocument();
    expect(screen.getByText('@Bob')).toBeInTheDocument();
  });

  it('renders HTML-looking message content as literal, inert text', async () => {
    vi.spyOn(communityChatService, 'listCommunityMessages').mockResolvedValue({
      data: [makeMessage({ content: '<script>alert(1)</script> hi' })],
      meta: { hasMore: false, oldestId: 'm1' },
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openCommunity(user);

    await waitFor(() =>
      expect(screen.getByText('<script>alert(1)</script> hi')).toBeInTheDocument(),
    );
    expect(document.querySelector('script[src=""]')).not.toBeInTheDocument();
  });

  it('renders a URL in a message as a wrapped, clickable link', async () => {
    vi.spyOn(communityChatService, 'listCommunityMessages').mockResolvedValue({
      data: [makeMessage({ content: 'check https://example.com/very/long/path out' })],
      meta: { hasMore: false, oldestId: 'm1' },
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openCommunity(user);

    await waitFor(() => {
      const link = screen.getByRole('link', { name: 'https://example.com/very/long/path' });
      expect(link).toHaveAttribute('href', 'https://example.com/very/long/path');
      expect(link).toHaveAttribute('target', '_blank');
    });
  });
});

describe('CommunityChatPanel — composer', () => {
  it('disables Send for empty/whitespace-only input and trims before sending', async () => {
    const sendSpy = vi.spyOn(communityChatService, 'sendCommunityMessage').mockResolvedValue(makeMessage());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openCommunity(user);
    await waitFor(() => expect(screen.getByText(/no messages yet/i)).toBeInTheDocument());

    expect(communitySendButton()).toBeDisabled();
    await user.type(communityComposer(), '   ');
    expect(communitySendButton()).toBeDisabled();

    await user.type(communityComposer(), 'hello there  ');
    await user.click(communitySendButton());

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0][1]).toBe('hello there');
  });

  it('Enter sends, Shift+Enter inserts a newline, and a composing Enter does not send', async () => {
    const sendSpy = vi.spyOn(communityChatService, 'sendCommunityMessage').mockResolvedValue(makeMessage());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openCommunity(user);
    await waitFor(() => expect(screen.getByText(/no messages yet/i)).toBeInTheDocument());

    await user.type(communityComposer(), 'line one');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.type(communityComposer(), 'line two');
    expect(sendSpy).not.toHaveBeenCalled();
    expect(communityComposer()).toHaveValue('line one\nline two');

    fireEvent.keyDown(communityComposer(), { key: 'Enter', isComposing: true });
    expect(sendSpy).not.toHaveBeenCalled();

    fireEvent.keyDown(communityComposer(), { key: 'Enter', isComposing: false });
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it('does not submit a second message while one is still in flight', async () => {
    let resolveSend: (value: CommunityMessage) => void = () => {};
    const sendSpy = vi
      .spyOn(communityChatService, 'sendCommunityMessage')
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSend = resolve;
          }),
      );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openCommunity(user);
    await waitFor(() => expect(screen.getByText(/no messages yet/i)).toBeInTheDocument());

    await user.type(communityComposer(), 'first{Enter}');
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(communitySendButton()).toBeDisabled();
    expect(communityComposer()).toBeDisabled();

    resolveSend(makeMessage({ clientMessageId: sendSpy.mock.calls[0][0] as string, content: 'first' }));
    await waitFor(() => expect(screen.getByText('first')).toBeInTheDocument());
  });

  it('a failed send preserves the pending bubble, and Retry reuses the same clientMessageId', async () => {
    const sendSpy = vi
      .spyOn(communityChatService, 'sendCommunityMessage')
      .mockRejectedValueOnce(new Error('network'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openCommunity(user);
    await waitFor(() => expect(screen.getByText(/no messages yet/i)).toBeInTheDocument());

    await user.type(communityComposer(), 'retry me{Enter}');
    await waitFor(() => expect(screen.getByText(/couldn't send this message/i)).toBeInTheDocument());
    expect(screen.getByText('retry me')).toBeInTheDocument();

    const firstClientId = sendSpy.mock.calls[0][0] as string;
    sendSpy.mockResolvedValueOnce(makeMessage({ clientMessageId: firstClientId, content: 'retry me' }));
    await user.click(screen.getByRole('button', { name: /^retry$/i }));

    expect(sendSpy).toHaveBeenCalledTimes(2);
    expect(sendSpy.mock.calls[1][0]).toBe(firstClientId);
  });

  it('refocuses the composer once a send resolves, so the next message can be typed right away', async () => {
    let resolveSend: (value: CommunityMessage) => void = () => {};
    const sendSpy = vi
      .spyOn(communityChatService, 'sendCommunityMessage')
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSend = resolve;
          }),
      );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openCommunity(user);
    await waitFor(() => expect(screen.getByText(/no messages yet/i)).toBeInTheDocument());

    await user.type(communityComposer(), 'first{Enter}');
    // The disabled composer is blurred by the browser the instant it
    // disables — re-enabling it later does not restore focus on its own.
    expect(communityComposer()).toBeDisabled();

    resolveSend(makeMessage({ clientMessageId: sendSpy.mock.calls[0][0] as string, content: 'first' }));
    await waitFor(() => expect(screen.getByText('first')).toBeInTheDocument());

    expect(communityComposer()).not.toBeDisabled();
    expect(communityComposer()).toHaveFocus();
  });

  it('maps a 429 response to the rate-limited message', async () => {
    vi.spyOn(communityChatService, 'sendCommunityMessage').mockRejectedValueOnce(
      new ApiError('Too many requests', 429),
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openCommunity(user);
    await waitFor(() => expect(screen.getByText(/no messages yet/i)).toBeInTheDocument());

    await user.type(communityComposer(), 'fast{Enter}');
    await waitFor(() => expect(screen.getByText(/sending messages too quickly/i)).toBeInTheDocument());
  });
});

describe('CommunityChatPanel — WebSocket dedup', () => {
  it('does not duplicate a message when the WS broadcast arrives before the POST response', async () => {
    let resolveSend: () => void = () => {};
    vi.spyOn(communityChatService, 'sendCommunityMessage').mockImplementation(
      (clientMessageId) =>
        new Promise((resolve) => {
          resolveSend = () => resolve(makeMessage({ id: 'server-1', clientMessageId, content: 'race' }));
        }),
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openCommunity(user);
    await waitFor(() => expect(screen.getByText(/no messages yet/i)).toBeInTheDocument());
    await waitFor(() => expect(capturedHandlers).not.toBeNull());
    capturedHandlers!.onConnected();

    await user.type(communityComposer(), 'race{Enter}');
    const sendSpy = communityChatService.sendCommunityMessage as unknown as { mock: { calls: string[][] } };
    const clientMessageId = sendSpy.mock.calls[0][0];

    capturedHandlers!.onMessage(makeMessage({ id: 'server-1', clientMessageId, content: 'race' }));
    await waitFor(() => expect(screen.getAllByText('race')).toHaveLength(1));

    resolveSend();
    await waitFor(() => expect(screen.getAllByText('race')).toHaveLength(1));
  });

  it('does not duplicate a message when the POST response resolves before the WS broadcast', async () => {
    vi.spyOn(communityChatService, 'sendCommunityMessage').mockImplementation(async (clientMessageId, content) =>
      makeMessage({ id: 'server-2', clientMessageId, content }),
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openCommunity(user);
    await waitFor(() => expect(screen.getByText(/no messages yet/i)).toBeInTheDocument());
    await waitFor(() => expect(capturedHandlers).not.toBeNull());
    capturedHandlers!.onConnected();

    await user.type(communityComposer(), 'ordered{Enter}');
    await waitFor(() => expect(screen.getAllByText('ordered')).toHaveLength(1));

    const sendSpy = communityChatService.sendCommunityMessage as unknown as { mock: { calls: string[][] } };
    const clientMessageId = sendSpy.mock.calls[0][0];
    capturedHandlers!.onMessage(makeMessage({ id: 'server-2', clientMessageId, content: 'ordered' }));
    expect(screen.getAllByText('ordered')).toHaveLength(1);
  });

  it('appends a genuinely new broadcast from another user', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openCommunity(user);
    await waitFor(() => expect(screen.getByText(/no messages yet/i)).toBeInTheDocument());
    await waitFor(() => expect(capturedHandlers).not.toBeNull());
    capturedHandlers!.onConnected();

    capturedHandlers!.onMessage(
      makeMessage({
        id: 'other-1',
        clientMessageId: 'not-mine',
        content: 'hi from bob',
        author: { id: 'bob', name: 'Bob', avatarUrl: null, level: 4, isAdmin: false },
      }),
    );
    await waitFor(() => expect(screen.getByText('hi from bob')).toBeInTheDocument());
  });
});

describe('CommunityChatPanel — pagination', () => {
  it('loads and prepends older messages when scrolling to the top', async () => {
    vi.spyOn(communityChatService, 'listCommunityMessages').mockImplementation(async (before) => {
      if (!before) {
        return {
          data: [makeMessage({ id: 'm2', clientMessageId: 'c2', content: 'newer' })],
          meta: { hasMore: true, oldestId: 'm2' },
        };
      }
      return {
        data: [makeMessage({ id: 'm1', clientMessageId: 'c1', content: 'older' })],
        meta: { hasMore: false, oldestId: 'm1' },
      };
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openCommunity(user);

    await waitFor(() => expect(screen.getByText('newer')).toBeInTheDocument());
    expect(screen.queryByText('older')).not.toBeInTheDocument();

    fireEvent.scroll(screen.getByRole('log'), { target: { scrollTop: 0 } });

    await waitFor(() => expect(screen.getByText('older')).toBeInTheDocument());
    expect(screen.getByText('newer')).toBeInTheDocument();
  });
});

describe('CommunityChatPanel — connection status', () => {
  it('shows a reconnecting banner on connection loss and clears it once reconnected', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openCommunity(user);
    await waitFor(() => expect(capturedHandlers).not.toBeNull());
    capturedHandlers!.onConnected();

    capturedHandlers!.onConnectionLost();
    await waitFor(() => expect(screen.getByText(/reconnecting/i)).toBeInTheDocument());

    // Let the first backoff step (1s) elapse so the hook retries — this
    // time it succeeds.
    await vi.advanceTimersByTimeAsync(1100);
    await waitFor(() => expect(capturedHandlers).not.toBeNull());
    capturedHandlers!.onConnected();

    await waitFor(() => expect(screen.queryByText(/reconnecting/i)).not.toBeInTheDocument());
  });

  it('shows a terminal disconnected state after exhausting retries, and a manual reconnect tries again', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openCommunity(user);
    await waitFor(() => expect(capturedHandlers).not.toBeNull());
    capturedHandlers!.onConnected();

    // Every reconnect attempt from here fails at the ticket step.
    vi.spyOn(communityChatService, 'issueCommunityLiveTicket').mockRejectedValue(new Error('down'));
    capturedHandlers!.onConnectionLost();

    // Exhaust all 5 backoff steps (1+2+4+8+16s) plus margin.
    await vi.advanceTimersByTimeAsync(1000 + 2000 + 4000 + 8000 + 16000 + 500);

    await waitFor(() => expect(screen.getByText(/couldn't reconnect/i)).toBeInTheDocument());

    const ticketSpy = vi
      .spyOn(communityChatService, 'issueCommunityLiveTicket')
      .mockResolvedValue({ ticket: 'fresh-ticket' });
    await user.click(screen.getByRole('button', { name: /reconnect/i }));

    await waitFor(() => expect(ticketSpy).toHaveBeenCalled());
  });
});

describe('CommunityChatPanel — unread badge (2026-08-26)', () => {
  it('shows the same count on both the mascot launcher and the Tán gẫu tab, capped at 9+', async () => {
    vi.spyOn(communityChatService, 'getUnreadCommunityMessageCount').mockResolvedValue(12);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();

    // Visible on the launcher without ever opening the panel.
    await waitFor(() => expect(within(chatLauncher()!).getByText('9+')).toBeInTheDocument());

    await openChat(user);
    expect(within(screen.getByRole('tab', { name: /community/i })).getByText('9+')).toBeInTheDocument();
  });

  it('shows nothing when the count is 0', async () => {
    renderBoundary();
    await waitFor(() => expect(communityChatService.getUnreadCommunityMessageCount).toHaveBeenCalled());

    expect(within(chatLauncher()!).queryByText(/\d/)).not.toBeInTheDocument();
  });

  it('opening the Tán gẫu tab marks read once immediately and clears both badges', async () => {
    vi.spyOn(communityChatService, 'getUnreadCommunityMessageCount')
      .mockResolvedValueOnce(5) // initial poll on mount
      .mockResolvedValue(0); // the refresh triggered right after mark-read
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await waitFor(() => expect(within(chatLauncher()!).getByText('5')).toBeInTheDocument());

    await openCommunity(user);

    expect(communityChatService.markCommunityMessagesRead).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(within(chatLauncher()!).queryByText(/\d/)).not.toBeInTheDocument());
    expect(
      within(screen.getByRole('tab', { name: /community/i })).queryByText(/\d/),
    ).not.toBeInTheDocument();
  });

  it('a live message from someone else while the tab is active triggers a debounced mark-read call; the count stays flat for the sender\'s own echoed message', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openCommunity(user);
    await waitFor(() => expect(capturedHandlers).not.toBeNull());
    expect(communityChatService.markCommunityMessagesRead).toHaveBeenCalledTimes(1); // from activation

    capturedHandlers!.onMessage(makeMessage({ id: 'live-1', author: { id: 'other-user', name: 'Alice', avatarUrl: null, level: 5, isAdmin: false } }));
    await waitFor(() => expect(communityChatService.markCommunityMessagesRead).toHaveBeenCalledTimes(2));

    capturedHandlers!.onMessage(
      makeMessage({ id: 'live-2', clientMessageId: 'own-echo', author: { id: 'me', name: 'Me', avatarUrl: null, level: 1, isAdmin: false } }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    expect(communityChatService.markCommunityMessagesRead).toHaveBeenCalledTimes(2);
  });

  it('a burst of several incoming messages while active produces exactly one debounced mark-read call, not one per message', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openCommunity(user);
    await waitFor(() => expect(capturedHandlers).not.toBeNull());
    expect(communityChatService.markCommunityMessagesRead).toHaveBeenCalledTimes(1); // from activation

    for (let i = 0; i < 5; i += 1) {
      capturedHandlers!.onMessage(
        makeMessage({
          id: `burst-${i}`,
          content: `burst ${i}`,
          author: { id: 'other-user', name: 'Alice', avatarUrl: null, level: 5, isAdmin: false },
        }),
      );
    }

    await waitFor(() => expect(communityChatService.markCommunityMessagesRead).toHaveBeenCalledTimes(2));
    // No further calls once the debounce window has long passed.
    await vi.advanceTimersByTimeAsync(2000);
    expect(communityChatService.markCommunityMessagesRead).toHaveBeenCalledTimes(2);
  });

  it('does NOT mark-read for a live message while the tab is inactive (Engy is the visible tab), but DOES refresh the badge count live instead of waiting for the 60s poll', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openCommunity(user); // activates the socket + fires the activation mark-read
    await waitFor(() => expect(capturedHandlers).not.toBeNull());
    await switchToEngy(user);
    const markReadCallsAfterActivation = (
      communityChatService.markCommunityMessagesRead as unknown as { mock: { calls: unknown[] } }
    ).mock.calls.length;
    const refreshCallsBeforeMessage = (
      communityChatService.getUnreadCommunityMessageCount as unknown as { mock: { calls: unknown[] } }
    ).mock.calls.length;

    capturedHandlers!.onMessage(makeMessage({ id: 'while-hidden', author: { id: 'other-user', name: 'Alice', avatarUrl: null, level: 5, isAdmin: false } }));
    await vi.advanceTimersByTimeAsync(1000);

    expect(communityChatService.markCommunityMessagesRead).toHaveBeenCalledTimes(markReadCallsAfterActivation);
    expect(
      (communityChatService.getUnreadCommunityMessageCount as unknown as { mock: { calls: unknown[] } }).mock.calls
        .length,
    ).toBeGreaterThan(refreshCallsBeforeMessage);
  });

  it('a live message from the viewer\'s own account while inactive triggers neither mark-read nor an extra badge refresh', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openCommunity(user);
    await waitFor(() => expect(capturedHandlers).not.toBeNull());
    await switchToEngy(user);
    const markReadCallsBefore = (
      communityChatService.markCommunityMessagesRead as unknown as { mock: { calls: unknown[] } }
    ).mock.calls.length;
    const refreshCallsBefore = (
      communityChatService.getUnreadCommunityMessageCount as unknown as { mock: { calls: unknown[] } }
    ).mock.calls.length;

    capturedHandlers!.onMessage(
      makeMessage({ id: 'own-while-hidden', clientMessageId: 'own-echo-2', author: { id: 'me', name: 'Me', avatarUrl: null, level: 1, isAdmin: false } }),
    );
    await vi.advanceTimersByTimeAsync(1000);

    expect(communityChatService.markCommunityMessagesRead).toHaveBeenCalledTimes(markReadCallsBefore);
    expect(
      (communityChatService.getUnreadCommunityMessageCount as unknown as { mock: { calls: unknown[] } }).mock.calls
        .length,
    ).toBe(refreshCallsBefore);
  });

  it('a burst of several incoming messages while inactive produces exactly one extra badge refresh, not one per message', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openCommunity(user);
    await waitFor(() => expect(capturedHandlers).not.toBeNull());
    await switchToEngy(user);
    const refreshCallsBefore = (
      communityChatService.getUnreadCommunityMessageCount as unknown as { mock: { calls: unknown[] } }
    ).mock.calls.length;

    for (let i = 0; i < 5; i += 1) {
      capturedHandlers!.onMessage(
        makeMessage({
          id: `burst-hidden-${i}`,
          content: `burst ${i}`,
          author: { id: 'other-user', name: 'Alice', avatarUrl: null, level: 5, isAdmin: false },
        }),
      );
    }
    await vi.advanceTimersByTimeAsync(1000);

    expect(
      (communityChatService.getUnreadCommunityMessageCount as unknown as { mock: { calls: unknown[] } }).mock.calls
        .length,
    ).toBe(refreshCallsBefore + 1);
  });

  it('switching to the tab before the debounce window elapses resolves the pending reaction as mark-read, not a bare refresh — proving it reads active state at fire time, not at message-arrival time', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openCommunity(user);
    await waitFor(() => expect(capturedHandlers).not.toBeNull());
    await switchToEngy(user);
    const markReadCallsBefore = (
      communityChatService.markCommunityMessagesRead as unknown as { mock: { calls: unknown[] } }
    ).mock.calls.length;

    capturedHandlers!.onMessage(
      makeMessage({ id: 'arrives-then-switch', author: { id: 'other-user', name: 'Alice', avatarUrl: null, level: 5, isAdmin: false } }),
    );
    await vi.advanceTimersByTimeAsync(200); // inside the 500ms debounce window — reaction still pending
    // Switching back to Community fires its OWN immediate mark-read (the
    // pre-existing "opening/returning to the tab" effect, unchanged by this
    // fix) — that's +1 on its own. The pending debounced reaction from the
    // message above then ALSO fires shortly after, and must resolve as a
    // SECOND mark-read (not a bare refresh) because activeRef.current is
    // true by the time it runs — that's the +2 this test is really pinning.
    // If the ref read stale schedule-time state instead, this would stop at
    // +1, since the reaction would wrongly take the refresh-only branch.
    await switchToCommunity(user);
    await vi.advanceTimersByTimeAsync(400); // lets the pending reaction timer fire

    expect(communityChatService.markCommunityMessagesRead).toHaveBeenCalledTimes(markReadCallsBefore + 2);
  });
});
