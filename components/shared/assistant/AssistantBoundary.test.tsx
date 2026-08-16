import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, act, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import AssistantBoundary from './AssistantBoundary';
import { useAssistant, useAssistantLessonContext, useAssistantLock } from './useAssistant';
import * as dictionaryService from '../../../services/dictionaryService';
import * as chatService from '../../../services/chatService';
import { ApiError } from '../../../services/apiError';

// Phase A + Phase B + Phase C — the floating shell (single-slot open/close,
// Escape/outside-click with focus restoration, the recording lock hiding
// both launchers, Dictionary <-> Engy mutual exclusivity), the Dictionary
// lookup/autocomplete states, the Engy ChatPanel, and the Phase C lesson
// context / Dictionary->Engy hand-off, driven end to end through the real
// boundary rather than each piece in isolation — same rationale
// XpToast.test.tsx gives for testing through GamificationProvider.

const LockingProbe: React.FC<{ active: boolean }> = ({ active }) => {
  useAssistantLock({ active, reason: 'uxRecording' });
  return null;
};

// Phase C test doubles — stand in for LessonPage (registers ambient lesson
// context) and DictionaryPanel's "Ask Engy" button (fires a one-shot
// hand-off) without needing to render either real, heavier component.
const LessonContextProbe: React.FC<{ lessonId: string; stage: 'video' | 'theory' | 'quiz' }> = ({
  lessonId,
  stage,
}) => {
  useAssistantLessonContext({ lessonId, stage });
  return null;
};

const HandoffButton: React.FC<{ prefillMessage: string; context: chatService.ChatContextInput }> = ({
  prefillMessage,
  context,
}) => {
  const assistant = useAssistant();
  return (
    <button type="button" onClick={() => assistant?.handoffToChat({ prefillMessage, context })}>
      Ask Engy about this word
    </button>
  );
};

const renderBoundary = (extraChildren: React.ReactNode = null) =>
  render(
    <LanguageProvider>
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route element={<AssistantBoundary />}>
            <Route path="/home" element={<>{extraChildren}<p>page</p></>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );

// Two independent triggers since Phase B (see AssistantLauncher.tsx) — the
// mascot ("Engy") now opens Chat, a separate button opens Dictionary.
const dictionaryLauncher = () => screen.queryByRole('button', { name: /dictionary/i });
const chatLauncher = () => screen.queryByRole('button', { name: /engy/i });
const panel = () => screen.queryByRole('dialog');

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  // Safe default for every test in this file: autocomplete must never hit a
  // real network call just because a test only cares about exact lookup.
  // Tests about suggestions themselves override this per-call below.
  vi.spyOn(dictionaryService, 'suggestWords').mockResolvedValue([]);
  // Safe default so opening ChatPanel in a test that isn't ABOUT session
  // restore never hits a real network call.
  vi.spyOn(chatService, 'getChatSession').mockResolvedValue({ turns: [], expiresAt: null });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('AssistantBoundary shell', () => {
  it('renders both launchers on a wrapped route', () => {
    renderBoundary();
    expect(dictionaryLauncher()).toBeInTheDocument();
    expect(chatLauncher()).toBeInTheDocument();
    expect(panel()).not.toBeInTheDocument();
  });

  it('opens the Dictionary panel on click, closes it on a second click (single slot)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();

    await user.click(dictionaryLauncher()!);
    expect(panel()).toBeInTheDocument();

    await user.click(dictionaryLauncher()!);
    expect(panel()).not.toBeInTheDocument();
  });

  it('closes on Escape and restores focus to the launcher', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();

    await user.click(dictionaryLauncher()!);
    expect(panel()).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(panel()).not.toBeInTheDocument();
    expect(dictionaryLauncher()).toHaveFocus();
  });

  it('closes on an outside click, but a click on the launcher itself does not double-toggle', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();

    await user.click(dictionaryLauncher()!);
    expect(panel()).toBeInTheDocument();

    await user.click(screen.getByText('page'));
    expect(panel()).not.toBeInTheDocument();

    // Reopen, then click the launcher again — must end up CLOSED (one
    // toggle), not immediately reopened by a race between the outside-click
    // handler and the launcher's own onClick.
    await user.click(dictionaryLauncher()!);
    expect(panel()).toBeInTheDocument();
    await user.click(dictionaryLauncher()!);
    expect(panel()).not.toBeInTheDocument();
  });

  it('opening Engy closes an open Dictionary, and opening Dictionary closes an open Engy', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();

    await user.click(dictionaryLauncher()!);
    expect(screen.getByRole('dialog', { name: /dictionary/i })).toBeInTheDocument();

    await user.click(chatLauncher()!);
    expect(screen.queryByRole('dialog', { name: /dictionary/i })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Engy' })).toBeInTheDocument();

    await user.click(dictionaryLauncher()!);
    expect(screen.queryByRole('dialog', { name: 'Engy' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /dictionary/i })).toBeInTheDocument();
  });

  it('hides both launchers while a lock is active, and closes an already-open panel', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { rerender } = renderBoundary(<LockingProbe active={false} />);

    await user.click(dictionaryLauncher()!);
    expect(panel()).toBeInTheDocument();

    rerender(
      <LanguageProvider>
        <MemoryRouter initialEntries={['/home']}>
          <Routes>
            <Route element={<AssistantBoundary />}>
              <Route
                path="/home"
                element={
                  <>
                    <LockingProbe active={true} />
                    <p>page</p>
                  </>
                }
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </LanguageProvider>,
    );

    expect(dictionaryLauncher()).not.toBeInTheDocument();
    expect(chatLauncher()).not.toBeInTheDocument();
    expect(panel()).not.toBeInTheDocument();
  });
});

describe('DictionaryPanel lookup states', () => {
  const openPanel = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(dictionaryLauncher()!);
  };

  it('shows the empty state with no query', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openPanel(user);

    expect(screen.getByText(/search an english word/i)).toBeInTheDocument();
  });

  it('rejects a query with digits/symbols client-side, without calling the service', async () => {
    const lookupSpy = vi.spyOn(dictionaryService, 'lookupWord');
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openPanel(user);

    await user.type(screen.getByPlaceholderText(/accomplish/i), 'abc123');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.getByText(/using english letters only/i)).toBeInTheDocument();
    expect(lookupSpy).not.toHaveBeenCalled();
  });

  it('typing alone never triggers an exact lookup — only Enter/submit or picking a suggestion does', async () => {
    const lookupSpy = vi.spyOn(dictionaryService, 'lookupWord');
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openPanel(user);

    await user.type(screen.getByPlaceholderText(/accomplish/i), 'hello');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(lookupSpy).not.toHaveBeenCalled();
  });

  it('pressing Enter runs the exact lookup for the typed query', async () => {
    const lookupSpy = vi
      .spyOn(dictionaryService, 'lookupWord')
      .mockResolvedValue(resultFixture());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openPanel(user);

    await user.type(screen.getByPlaceholderText(/accomplish/i), 'hello');
    await user.keyboard('{Enter}');

    expect(lookupSpy).toHaveBeenCalledTimes(1);
    expect(lookupSpy).toHaveBeenCalledWith('hello');
  });

  it('renders a successful lookup: word, VI meaning, definitions, examples, synonyms', async () => {
    vi.spyOn(dictionaryService, 'lookupWord').mockResolvedValue(resultFixture());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openPanel(user);

    await user.type(screen.getByPlaceholderText(/accomplish/i), 'hello');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(screen.getByText('hello')).toBeInTheDocument());
    expect(screen.getByText('Xin chào')).toBeInTheDocument();
    expect(screen.getByText('A greeting.')).toBeInTheDocument();
    expect(screen.getByText('hi')).toBeInTheDocument();
  });

  it('shows an honest not-found state on a 404, never a fabricated definition', async () => {
    vi.spyOn(dictionaryService, 'lookupWord').mockRejectedValue(
      new ApiError('not found', 404),
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openPanel(user);

    await user.type(screen.getByPlaceholderText(/accomplish/i), 'zzzzz');
    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(screen.getByText(/no dictionary entry found/i)).toBeInTheDocument(),
    );
  });

  it('shows a rate-limit-specific message on a 429', async () => {
    vi.spyOn(dictionaryService, 'lookupWord').mockRejectedValue(
      new ApiError('slow down', 429),
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openPanel(user);

    await user.type(screen.getByPlaceholderText(/accomplish/i), 'hello');
    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(screen.getByText(/looking up words too quickly/i)).toBeInTheDocument(),
    );
  });

  it('discards a superseded response — only the latest query wins', async () => {
    let resolveFirst: (value: dictionaryService.DictionaryLookupResult) => void;
    const first = new Promise<dictionaryService.DictionaryLookupResult>((resolve) => {
      resolveFirst = resolve;
    });
    const lookupSpy = vi
      .spyOn(dictionaryService, 'lookupWord')
      .mockImplementationOnce(() => first)
      .mockImplementationOnce(() => Promise.resolve(resultFixture({ word: 'world' })));

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openPanel(user);

    const input = screen.getByPlaceholderText(/accomplish/i);
    await user.type(input, 'hello');
    await user.keyboard('{Enter}');
    await user.clear(input);
    await user.type(input, 'world');
    await user.keyboard('{Enter}');

    // The first (still-pending) request resolves AFTER the second already
    // settled — its result must never overwrite the newer one on screen.
    await act(async () => {
      resolveFirst(resultFixture({ word: 'hello' }));
    });

    await waitFor(() => expect(screen.getByText('world')).toBeInTheDocument());
    expect(screen.queryByText('hello')).not.toBeInTheDocument();
    expect(lookupSpy).toHaveBeenCalledTimes(2);
  });
});

describe('DictionaryPanel autocomplete', () => {
  const openPanel = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(dictionaryLauncher()!);
  };

  it('shows nothing for a 1-character query — too short to suggest', async () => {
    const suggestSpy = vi.spyOn(dictionaryService, 'suggestWords');
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openPanel(user);

    await user.type(screen.getByPlaceholderText(/accomplish/i), 'g');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(suggestSpy).not.toHaveBeenCalled();
  });

  it('resets suggestions immediately when the query shrinks back below 2 characters', async () => {
    vi.spyOn(dictionaryService, 'suggestWords').mockResolvedValue([
      { word: 'give', shortMeaningVi: 'đưa' },
    ]);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openPanel(user);

    const input = screen.getByPlaceholderText(/accomplish/i);
    await user.type(input, 'gi');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());

    await user.type(input, '{Backspace}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('debounces typing and fetches suggestions for the settled prefix only', async () => {
    const suggestSpy = vi
      .spyOn(dictionaryService, 'suggestWords')
      .mockResolvedValue([{ word: 'hello', shortMeaningVi: 'Xin chào' }]);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openPanel(user);

    await user.type(screen.getByPlaceholderText(/accomplish/i), 'hello');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(suggestSpy).toHaveBeenCalledTimes(1);
    expect(suggestSpy).toHaveBeenCalledWith('hello', 6);
    await waitFor(() => expect(screen.getByRole('option')).toBeInTheDocument());
  });

  it('shows a loading state while suggestions are in flight, then the list', async () => {
    let resolveSuggest: (value: dictionaryService.DictionarySuggestion[]) => void;
    const pending = new Promise<dictionaryService.DictionarySuggestion[]>((resolve) => {
      resolveSuggest = resolve;
    });
    vi.spyOn(dictionaryService, 'suggestWords').mockReturnValue(pending);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openPanel(user);

    await user.type(screen.getByPlaceholderText(/accomplish/i), 'gi');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(screen.getByRole('status')).toBeInTheDocument();

    await act(async () => {
      resolveSuggest([{ word: 'give', shortMeaningVi: 'đưa' }]);
    });

    await waitFor(() => expect(screen.getByText('give')).toBeInTheDocument());
  });

  it('zero local matches shows an actionable exact-lookup fallback, not a dead end', async () => {
    // "responsible" has no VocabWord entry but IS resolvable via the
    // existing exact lookup (Redis/external) — the empty-suggestions state
    // must offer that action, not just report "no suggestions".
    vi.spyOn(dictionaryService, 'suggestWords').mockResolvedValue([]);
    const lookupSpy = vi.spyOn(dictionaryService, 'lookupWord');
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openPanel(user);

    await user.type(screen.getByPlaceholderText(/accomplish/i), 'responsible');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    await waitFor(() =>
      expect(screen.getByText('Search "responsible"')).toBeInTheDocument(),
    );
    expect(screen.getByText(/press enter to search the dictionary/i)).toBeInTheDocument();
    // Typing alone must never trigger the exact lookup automatically, even
    // once the fallback is showing.
    expect(lookupSpy).not.toHaveBeenCalled();
  });

  it('clicking the exact-lookup fallback performs the exact lookup for the trimmed query', async () => {
    vi.spyOn(dictionaryService, 'suggestWords').mockResolvedValue([]);
    const lookupSpy = vi
      .spyOn(dictionaryService, 'lookupWord')
      .mockResolvedValue(resultFixture({ word: 'responsible' }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openPanel(user);

    await user.type(screen.getByPlaceholderText(/accomplish/i), 'responsible');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    await waitFor(() =>
      expect(screen.getByText('Search "responsible"')).toBeInTheDocument(),
    );

    await user.click(screen.getByText('Search "responsible"'));

    expect(lookupSpy).toHaveBeenCalledWith('responsible');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('responsible')).toBeInTheDocument());
  });

  it('pressing Enter with zero local suggestions performs the exact lookup', async () => {
    vi.spyOn(dictionaryService, 'suggestWords').mockResolvedValue([]);
    const lookupSpy = vi
      .spyOn(dictionaryService, 'lookupWord')
      .mockResolvedValue(resultFixture({ word: 'responsible' }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openPanel(user);

    await user.type(screen.getByPlaceholderText(/accomplish/i), 'responsible');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    await waitFor(() =>
      expect(screen.getByText('Search "responsible"')).toBeInTheDocument(),
    );

    await user.keyboard('{Enter}');

    expect(lookupSpy).toHaveBeenCalledWith('responsible');
    await waitFor(() => expect(screen.getByText('responsible')).toBeInTheDocument());
  });

  it('shows a soft error without breaking the panel when suggestions fail', async () => {
    vi.spyOn(dictionaryService, 'suggestWords').mockRejectedValue(new Error('network down'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openPanel(user);

    await user.type(screen.getByPlaceholderText(/accomplish/i), 'gi');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    await waitFor(() =>
      expect(screen.getByText(/could not load suggestions/i)).toBeInTheDocument(),
    );
  });

  it('discards a stale suggestion response — only the latest prefix wins', async () => {
    let resolveFirst: (value: dictionaryService.DictionarySuggestion[]) => void;
    const first = new Promise<dictionaryService.DictionarySuggestion[]>((resolve) => {
      resolveFirst = resolve;
    });
    vi.spyOn(dictionaryService, 'suggestWords')
      .mockImplementationOnce(() => first)
      .mockImplementationOnce(() =>
        Promise.resolve([{ word: 'world', shortMeaningVi: 'thế giới' }]),
      );

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openPanel(user);

    const input = screen.getByPlaceholderText(/accomplish/i);
    await user.type(input, 'he');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    await user.clear(input);
    await user.type(input, 'wo');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    await act(async () => {
      resolveFirst([{ word: 'hello', shortMeaningVi: 'Xin chào' }]);
    });

    await waitFor(() => expect(screen.getByText('world')).toBeInTheDocument());
    expect(screen.queryByText('hello')).not.toBeInTheDocument();
  });

  it('ArrowDown/ArrowUp move the highlight, and Enter selects the highlighted suggestion', async () => {
    vi.spyOn(dictionaryService, 'suggestWords').mockResolvedValue([
      { word: 'give', shortMeaningVi: 'đưa' },
      { word: 'give up', shortMeaningVi: 'từ bỏ' },
    ]);
    const lookupSpy = vi
      .spyOn(dictionaryService, 'lookupWord')
      .mockResolvedValue(resultFixture({ word: 'give up' }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openPanel(user);

    const input = screen.getByPlaceholderText(/accomplish/i);
    await user.type(input, 'gi');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));

    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(lookupSpy).toHaveBeenCalledWith('give up');
    expect(input).toHaveValue('give up');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('clicking a suggestion fills the input, closes the list, and runs the exact lookup', async () => {
    vi.spyOn(dictionaryService, 'suggestWords').mockResolvedValue([
      { word: 'give', shortMeaningVi: 'đưa' },
    ]);
    const lookupSpy = vi
      .spyOn(dictionaryService, 'lookupWord')
      .mockResolvedValue(resultFixture({ word: 'give' }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openPanel(user);

    const input = screen.getByPlaceholderText(/accomplish/i);
    await user.type(input, 'gi');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    await waitFor(() => expect(screen.getByRole('option')).toBeInTheDocument());

    await user.click(screen.getByRole('option'));

    expect(input).toHaveValue('give');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(lookupSpy).toHaveBeenCalledWith('give');
    await waitFor(() => expect(screen.getByText('give')).toBeInTheDocument());
  });

  it('first Escape closes only the suggestion dropdown; a second Escape then closes the panel', async () => {
    vi.spyOn(dictionaryService, 'suggestWords').mockResolvedValue([
      { word: 'give', shortMeaningVi: 'đưa' },
    ]);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openPanel(user);

    const input = screen.getByPlaceholderText(/accomplish/i);
    await user.type(input, 'gi');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(panel()).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(panel()).not.toBeInTheDocument();
  });
});

describe('ChatPanel', () => {
  const openChat = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(chatLauncher()!);
  };
  const composer = () => screen.getByRole('textbox', { name: /message engy/i });

  it('opens on the Engy launcher and shows the greeting when there is no history', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openChat(user);

    expect(screen.getByRole('dialog', { name: 'Engy' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/hi! i'm engy/i)).toBeInTheDocument());
  });

  it('restores prior turns from GET /chat/session on open', async () => {
    vi.spyOn(chatService, 'getChatSession').mockResolvedValue({
      turns: [
        { role: 'user', text: 'What does resign mean?', at: 1 },
        { role: 'assistant', text: 'It means to quit a job.', at: 2 },
      ],
      expiresAt: '2026-01-01T00:00:00.000Z',
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openChat(user);

    await waitFor(() =>
      expect(screen.getByText('What does resign mean?')).toBeInTheDocument(),
    );
    expect(screen.getByText('It means to quit a job.')).toBeInTheDocument();
    // Restored history means no greeting placeholder.
    expect(screen.queryByText(/hi! i'm engy/i)).not.toBeInTheDocument();
  });

  it('sends a message via the send button and renders both bubbles', async () => {
    const sendSpy = vi
      .spyOn(chatService, 'sendChatMessage')
      .mockResolvedValue({ clientMessageId: 'x', reply: 'Sure, happy to help!', repliedAt: 't' });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openChat(user);

    await user.type(composer(), 'Explain present perfect');
    await user.click(screen.getByRole('button', { name: /^send$/i }));

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0][1]).toBe('Explain present perfect');
    await waitFor(() =>
      expect(screen.getByText('Explain present perfect')).toBeInTheDocument(),
    );
    expect(screen.getByText('Sure, happy to help!')).toBeInTheDocument();
    expect(composer()).toHaveValue(''); // composer clears after sending
  });

  it('Enter sends the message', async () => {
    const sendSpy = vi
      .spyOn(chatService, 'sendChatMessage')
      .mockResolvedValue({ clientMessageId: 'x', reply: 'ok', repliedAt: 't' });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openChat(user);

    await user.type(composer(), 'hello{Enter}');

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0][1]).toBe('hello');
  });

  it('Shift+Enter inserts a newline instead of sending', async () => {
    const sendSpy = vi.spyOn(chatService, 'sendChatMessage');
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openChat(user);

    await user.type(composer(), 'line one');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.type(composer(), 'line two');

    expect(sendSpy).not.toHaveBeenCalled();
    expect(composer()).toHaveValue('line one\nline two');
  });

  it('does not send whitespace-only input', async () => {
    const sendSpy = vi.spyOn(chatService, 'sendChatMessage');
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openChat(user);

    await user.type(composer(), '   {Enter}');

    expect(sendSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /^send$/i }));
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('an Enter that confirms IME composition does not send', async () => {
    const sendSpy = vi.spyOn(chatService, 'sendChatMessage');
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openChat(user);

    await user.type(composer(), 'こんにちは');
    fireEvent.keyDown(composer(), { key: 'Enter', isComposing: true });

    expect(sendSpy).not.toHaveBeenCalled();
    expect(composer()).toHaveValue('こんにちは');

    // A real, non-composing Enter afterwards still sends normally — the
    // guard only suppresses the composition-confirming keystroke.
    fireEvent.keyDown(composer(), { key: 'Enter', isComposing: false });
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it('renders assistant Markdown as formatted text, not visible markup', async () => {
    vi.spyOn(chatService, 'sendChatMessage').mockResolvedValue({
      clientMessageId: 'x',
      reply: '### Công thức\n**S + have/has + V3/ed**',
      repliedAt: '2026-01-01T00:00:00.000Z',
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openChat(user);

    await user.type(composer(), 'formula please{Enter}');

    const heading = await screen.findByRole('heading', { name: 'Công thức' });
    expect(heading).toBeInTheDocument();
    expect(screen.getByText('S + have/has + V3/ed').tagName).toBe('STRONG');
    // The raw Markdown syntax itself must never be visible.
    expect(screen.queryByText(/###/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
  });

  it('renders assistant lists as real list markup', async () => {
    vi.spyOn(chatService, 'sendChatMessage').mockResolvedValue({
      clientMessageId: 'x',
      reply: '* first tip\n* second tip',
      repliedAt: '2026-01-01T00:00:00.000Z',
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openChat(user);

    await user.type(composer(), 'tips please{Enter}');

    const list = await screen.findByRole('list');
    expect(list.tagName).toBe('UL');
    expect(screen.getByText('first tip')).toBeInTheDocument();
    expect(screen.getByText('second tip')).toBeInTheDocument();
    expect(screen.queryByText(/\* first tip/)).not.toBeInTheDocument();
  });

  it('never interprets the user\'s own message as Markdown', async () => {
    vi.spyOn(chatService, 'sendChatMessage').mockResolvedValue({
      clientMessageId: 'x',
      reply: 'ok',
      repliedAt: '2026-01-01T00:00:00.000Z',
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openChat(user);

    await user.type(composer(), '**not bold** and # not a heading{Enter}');

    const userBubble = await screen.findByText('**not bold** and # not a heading');
    // Rendered as plain text, not turned into <strong>/<h*> elements.
    expect(userBubble.tagName).toBe('SPAN');
  });

  it('shows a thinking indicator while the reply is in flight, and disables the composer', async () => {
    let resolveSend: (value: chatService.SendChatMessageResult) => void;
    const pending = new Promise<chatService.SendChatMessageResult>((resolve) => {
      resolveSend = resolve;
    });
    vi.spyOn(chatService, 'sendChatMessage').mockReturnValue(pending);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openChat(user);

    await user.type(composer(), 'hello{Enter}');

    expect(screen.getByText(/engy is thinking/i)).toBeInTheDocument();
    expect(composer()).toBeDisabled();

    await act(async () => {
      resolveSend({ clientMessageId: 'x', reply: 'Hi!', repliedAt: 't' });
    });

    await waitFor(() => expect(screen.getByText('Hi!')).toBeInTheDocument());
    expect(composer()).not.toBeDisabled();
  });

  it('a rapid second Enter while sending does not fire a second request', async () => {
    let resolveSend: (value: chatService.SendChatMessageResult) => void;
    const pending = new Promise<chatService.SendChatMessageResult>((resolve) => {
      resolveSend = resolve;
    });
    const sendSpy = vi.spyOn(chatService, 'sendChatMessage').mockReturnValue(pending);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openChat(user);

    await user.type(composer(), 'hello{Enter}');
    // The composer is disabled once sending starts, so further Enter/typing
    // has nothing to act on — this proves the guard, not just the disabled attribute.
    await user.keyboard('{Enter}');

    expect(sendSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSend({ clientMessageId: 'x', reply: 'ok', repliedAt: 't' });
    });
  });

  it('a failed send shows an error and a Retry that reuses the SAME clientMessageId', async () => {
    const sendSpy = vi
      .spyOn(chatService, 'sendChatMessage')
      .mockRejectedValueOnce(new ApiError('down', 503))
      .mockResolvedValueOnce({ clientMessageId: 'x', reply: 'Recovered answer', repliedAt: 't' });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openChat(user);

    await user.type(composer(), 'hello{Enter}');

    await waitFor(() =>
      expect(screen.getByText(/couldn't send this message/i)).toBeInTheDocument(),
    );
    expect(sendSpy).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(screen.getByText('Recovered answer')).toBeInTheDocument());
    expect(sendSpy).toHaveBeenCalledTimes(2);
    const [firstId] = sendSpy.mock.calls[0];
    const [secondId] = sendSpy.mock.calls[1];
    expect(secondId).toBe(firstId); // the retry reused the same clientMessageId
  });

  it('shows a rate-limit-specific message on a 429', async () => {
    vi.spyOn(chatService, 'sendChatMessage').mockRejectedValue(new ApiError('slow down', 429));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openChat(user);

    await user.type(composer(), 'hello{Enter}');

    await waitFor(() =>
      expect(screen.getByText(/sending messages too quickly/i)).toBeInTheDocument(),
    );
  });

  it('"New conversation" clears the visible history', async () => {
    vi.spyOn(chatService, 'getChatSession').mockResolvedValue({
      turns: [
        { role: 'user', text: 'old question', at: 1 },
        { role: 'assistant', text: 'old answer', at: 2 },
      ],
      expiresAt: null,
    });
    const clearSpy = vi.spyOn(chatService, 'clearChatSession').mockResolvedValue(undefined);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openChat(user);
    await waitFor(() => expect(screen.getByText('old question')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /new conversation/i }));

    expect(clearSpy).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText('old question')).not.toBeInTheDocument());
    expect(screen.getByText(/hi! i'm engy/i)).toBeInTheDocument();
  });

  it('closes on Escape and restores focus to the Engy launcher', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openChat(user);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(chatLauncher()).toHaveFocus();
  });

  it('scrolls to the latest message when a new one arrives', async () => {
    // jsdom has no layout engine and does not implement scrollIntoView —
    // ChatPanel calls it defensively (optional chaining) for exactly this
    // reason. Spying on it here is the realistic ceiling for "auto-scroll"
    // coverage in this environment; the actual visual behaviour is a manual
    // QA item (see the Phase B QA checklist).
    const scrollIntoViewSpy = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.HTMLElement.prototype as any).scrollIntoView = scrollIntoViewSpy;
    vi.spyOn(chatService, 'sendChatMessage').mockResolvedValue({
      clientMessageId: 'x',
      reply: 'ok',
      repliedAt: 't',
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openChat(user);
    scrollIntoViewSpy.mockClear();

    await user.type(composer(), 'hello{Enter}');
    await waitFor(() => expect(screen.getByText('ok')).toBeInTheDocument());

    expect(scrollIntoViewSpy).toHaveBeenCalled();
  });
});

describe('Phase C — lesson context and Dictionary->Engy hand-off', () => {
  const openChat = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(chatLauncher()!);
  };
  const composer = () => screen.getByRole('textbox', { name: /message engy/i });

  it('a message sent while LessonPage-equivalent context is registered attaches LESSON context automatically', async () => {
    const sendSpy = vi
      .spyOn(chatService, 'sendChatMessage')
      .mockResolvedValue({ clientMessageId: 'x', reply: 'ok', repliedAt: 't' });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary(<LessonContextProbe lessonId="lesson-1" stage="theory" />);
    await openChat(user);

    await user.type(composer(), 'Explain this{Enter}');

    expect(sendSpy).toHaveBeenCalledWith(expect.any(String), 'Explain this', {
      type: 'LESSON',
      resourceId: 'lesson-1',
      stage: 'theory',
    });
  });

  it('without a registered lesson context, a message defaults to GENERAL', async () => {
    const sendSpy = vi
      .spyOn(chatService, 'sendChatMessage')
      .mockResolvedValue({ clientMessageId: 'x', reply: 'ok', repliedAt: 't' });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openChat(user);

    await user.type(composer(), 'hello{Enter}');

    expect(sendSpy).toHaveBeenCalledWith(expect.any(String), 'hello', { type: 'GENERAL' });
  });

  it('a Dictionary hand-off opens Chat, pre-fills the composer, and the NEXT send carries the handed-off VOCAB_WORD context', async () => {
    const sendSpy = vi
      .spyOn(chatService, 'sendChatMessage')
      .mockResolvedValue({ clientMessageId: 'x', reply: 'ok', repliedAt: 't' });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary(
      <HandoffButton
        prefillMessage='Explain "resign"'
        context={{ type: 'VOCAB_WORD', resourceId: 'word-1' }}
      />,
    );

    await user.click(screen.getByRole('button', { name: /ask engy about this word/i }));

    expect(screen.getByRole('dialog', { name: 'Engy' })).toBeInTheDocument();
    expect(composer()).toHaveValue('Explain "resign"');

    await user.keyboard('{Enter}');

    expect(sendSpy).toHaveBeenCalledWith(expect.any(String), 'Explain "resign"', {
      type: 'VOCAB_WORD',
      resourceId: 'word-1',
    });
  });

  it('the hand-off context applies to only ONE message — the next send reverts to ambient/GENERAL', async () => {
    const sendSpy = vi
      .spyOn(chatService, 'sendChatMessage')
      .mockResolvedValue({ clientMessageId: 'x', reply: 'ok', repliedAt: 't' });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary(
      <HandoffButton
        prefillMessage='Explain "resign"'
        context={{ type: 'VOCAB_WORD', resourceId: 'word-1' }}
      />,
    );

    await user.click(screen.getByRole('button', { name: /ask engy about this word/i }));
    await user.keyboard('{Enter}');
    await waitFor(() => expect(sendSpy).toHaveBeenCalledTimes(1));

    await user.type(composer(), 'A follow-up question{Enter}');

    expect(sendSpy).toHaveBeenNthCalledWith(2, expect.any(String), 'A follow-up question', {
      type: 'GENERAL',
    });
  });

  it('clicking a Dictionary hand-off while Dictionary is open switches to Chat (single slot still holds)', async () => {
    vi.spyOn(chatService, 'sendChatMessage').mockResolvedValue({
      clientMessageId: 'x',
      reply: 'ok',
      repliedAt: 't',
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary(
      <HandoffButton
        prefillMessage='Explain "resign"'
        context={{ type: 'VOCAB_WORD', resourceId: 'word-1' }}
      />,
    );

    await user.click(dictionaryLauncher()!);
    expect(screen.getByRole('dialog', { name: /dictionary/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /ask engy about this word/i }));

    expect(screen.queryByRole('dialog', { name: /dictionary/i })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Engy' })).toBeInTheDocument();
  });
});

function resultFixture(
  overrides: Partial<dictionaryService.DictionaryLookupResult> = {},
): dictionaryService.DictionaryLookupResult {
  return {
    word: 'hello',
    normalizedWord: 'hello',
    ipa: '/hɛˈloʊ/',
    audioUrl: null,
    meanings: [{ partOfSpeech: 'interjection', definitionEn: 'A greeting.', exampleEn: null }],
    synonyms: ['hi'],
    viTranslation: 'Xin chào',
    viTranslationSource: 'AI',
    sourceUrl: 'https://en.wiktionary.org/wiki/hello',
    source: 'EXTERNAL',
    vocabWordId: null,
    ...overrides,
  };
}
