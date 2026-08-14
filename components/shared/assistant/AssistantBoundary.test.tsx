import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import AssistantBoundary from './AssistantBoundary';
import { useAssistantLock } from './useAssistant';
import * as dictionaryService from '../../../services/dictionaryService';
import { ApiError } from '../../../services/apiError';

// Phase A — the floating shell (single-slot open/close, Escape/outside-click
// with focus restoration, the recording lock hiding the launcher) and the
// Dictionary lookup states, driven end to end through the real boundary
// rather than each piece in isolation — same rationale XpToast.test.tsx
// gives for testing through GamificationProvider.

const LockingProbe: React.FC<{ active: boolean }> = ({ active }) => {
  useAssistantLock({ active, reason: 'uxRecording' });
  return null;
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

const launcher = () => screen.queryByRole('button', { name: /engy/i });
const panel = () => screen.queryByRole('dialog');

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  // Safe default for every test in this file: autocomplete must never hit a
  // real network call just because a test only cares about exact lookup.
  // Tests about suggestions themselves override this per-call below.
  vi.spyOn(dictionaryService, 'suggestWords').mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('AssistantBoundary shell', () => {
  it('renders the launcher on a wrapped route', () => {
    renderBoundary();
    expect(launcher()).toBeInTheDocument();
    expect(panel()).not.toBeInTheDocument();
  });

  it('opens the Dictionary panel on click, closes it on a second click (single slot)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();

    await user.click(launcher()!);
    expect(panel()).toBeInTheDocument();

    await user.click(launcher()!);
    expect(panel()).not.toBeInTheDocument();
  });

  it('closes on Escape and restores focus to the launcher', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();

    await user.click(launcher()!);
    expect(panel()).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(panel()).not.toBeInTheDocument();
    expect(launcher()).toHaveFocus();
  });

  it('closes on an outside click, but a click on the launcher itself does not double-toggle', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();

    await user.click(launcher()!);
    expect(panel()).toBeInTheDocument();

    await user.click(screen.getByText('page'));
    expect(panel()).not.toBeInTheDocument();

    // Reopen, then click the launcher again — must end up CLOSED (one
    // toggle), not immediately reopened by a race between the outside-click
    // handler and the launcher's own onClick.
    await user.click(launcher()!);
    expect(panel()).toBeInTheDocument();
    await user.click(launcher()!);
    expect(panel()).not.toBeInTheDocument();
  });

  it('hides the launcher while a lock is active, and closes an already-open panel', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { rerender } = renderBoundary(<LockingProbe active={false} />);

    await user.click(launcher()!);
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

    expect(launcher()).not.toBeInTheDocument();
    expect(panel()).not.toBeInTheDocument();
  });
});

describe('DictionaryPanel lookup states', () => {
  const openPanel = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(launcher()!);
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
    await user.click(launcher()!);
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
