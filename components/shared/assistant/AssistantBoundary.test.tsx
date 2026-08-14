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

  it('debounces typing and only looks up the settled query once', async () => {
    const lookupSpy = vi
      .spyOn(dictionaryService, 'lookupWord')
      .mockResolvedValue(resultFixture());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openPanel(user);

    await user.type(screen.getByPlaceholderText(/accomplish/i), 'hello');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(lookupSpy).toHaveBeenCalledTimes(1);
    expect(lookupSpy).toHaveBeenCalledWith('hello');
  });

  it('renders a successful lookup: word, VI meaning, definitions, examples, synonyms', async () => {
    vi.spyOn(dictionaryService, 'lookupWord').mockResolvedValue(resultFixture());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();
    await openPanel(user);

    await user.type(screen.getByPlaceholderText(/accomplish/i), 'hello');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

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
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

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
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

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
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    await user.clear(input);
    await user.type(input, 'world');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

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
