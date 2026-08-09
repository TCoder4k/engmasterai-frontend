import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import ListeningContentPage from './ListeningContentPage';
import DictationModePanel from './DictationModePanel';
import ShadowingModePanel from './ShadowingModePanel';
import {
  getListeningContent,
  submitDictationAttempt,
} from '../../../services/listeningService';
import { ApiError } from '../../../services/apiError';

vi.mock('../../../services/listeningService', () => ({
  getListeningContent: vi.fn(),
  submitDictationAttempt: vi.fn(),
}));

// The real embed loads YouTube's IFrame API over the network. The mock stands
// in for the provider and immediately reports a ready player, which is what
// makes the transport controls testable at all. Its spies are hoisted so tests
// can assert what the page actually asked the player to do.
const ytPlayer = vi.hoisted(() => ({
  playVideo: vi.fn(),
  pauseVideo: vi.fn(),
  seekTo: vi.fn(),
  getCurrentTime: () => 0,
  setPlaybackRate: vi.fn(),
  getAvailablePlaybackRates: () => [0.5, 1, 2],
}));

vi.mock('../../lesson/video/YouTubeEmbed', () => ({
  default: ({ videoId, onReady }: { videoId: string; onReady: (p: unknown) => void }) => {
    React.useEffect(() => {
      onReady(ytPlayer);
    }, [onReady]);
    return <div data-testid="youtube-embed" data-video-id={videoId} />;
  },
}));

const mockedGetContent = vi.mocked(getListeningContent);
const mockedSubmit = vi.mocked(submitDictationAttempt);

/**
 * Sprint 11 Phase 4A — the server's verdict, faked.
 *
 * Solving a sentence is now a round trip: the panel posts what was typed and
 * only marks the sentence done when the SERVER says `solved`. So these tests
 * must stand in for that response, and doing so is itself the point — a test
 * that could still pass with the request removed would no longer be testing
 * the thing that matters.
 */
const serverSolves = (overrides: Record<string, unknown> = {}) =>
  mockedSubmit.mockResolvedValue({
    accuracyPercent: 100,
    wordsCorrect: 2,
    wordsTotal: 2,
    solved: true,
    assisted: false,
    segment: {
      segmentId: 'seg-1',
      completedAt: new Date().toISOString(),
      bestAccuracyPercent: 100,
      attemptCount: 1,
      assisted: false,
    },
    content: {
      totalSegments: 2,
      completedSegments: 1,
      completed: false,
      lastActivityAt: new Date().toISOString(),
    },
    ...overrides,
  } as never);

const CONTENT_ID = '11111111-1111-4111-8111-111111111111';

const baseContent = {
  id: CONTENT_ID,
  title: 'Otter Moms Wrap Their Babies',
  description: 'A short nature clip.',
  level: 'B1' as const,
  thumbnailUrl: null,
  sourceName: 'Nature Channel',
  sourceUrl: 'https://example.com/source',
  mediaType: 'VIDEO' as const,
  mediaProvider: 'YOUTUBE' as const,
  mediaUrl: 'https://www.youtube.com/watch?v=rkZ6gzyg7yY',
  externalMediaId: null,
  durationMs: 180000,
  supportedModes: ['DICTATION' as const],
  category: { id: 'cat-animals', name: 'Animals', nameVi: 'Động vật', orderIndex: 0 },
  segments: [
    {
      id: 'seg-1',
      orderIndex: 0,
      text: 'hi there',
      ipa: null,
      translationVi: 'xin chào bạn',
      startTimeMs: 0,
      endTimeMs: 3000,
    },
    {
      id: 'seg-2',
      orderIndex: 1,
      text: 'second one now',
      ipa: null,
      translationVi: 'câu thứ hai',
      startTimeMs: 3000,
      endTimeMs: 6000,
    },
  ],
};

// Mirrors App.tsx exactly — the redirect and the not-found rules are routing
// behaviour, so testing them against a different route tree would prove
// nothing about the app.
const renderAt = (path: string) =>
  render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/practice/listening/:contentId" element={<ListeningContentPage />}>
              <Route index element={<></>} />
              <Route path="dictation" element={<DictationModePanel />} />
              <Route path="shadowing" element={<ShadowingModePanel />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </ThemeProvider>,
  );

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('ListeningContentPage — load states', () => {
  it('shows a not-found surface for a 404, with a way back to the catalog', async () => {
    mockedGetContent.mockRejectedValue(new ApiError('not found', 404));

    renderAt(`/practice/listening/${CONTENT_ID}/dictation`);

    expect(
      await screen.findByText('This listening lesson could not be found.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to listening/i })).toHaveAttribute(
      'href',
      '/practice/listening',
    );
  });

  it('distinguishes a server failure from a missing recording, and can retry', async () => {
    mockedGetContent.mockRejectedValue(new ApiError('Không tải được bài nghe', 500));

    renderAt(`/practice/listening/${CONTENT_ID}/dictation`);

    expect(await screen.findByText('Không tải được bài nghe')).toBeInTheDocument();
    // A 500 must NOT claim the recording does not exist.
    expect(
      screen.queryByText('This listening lesson could not be found.'),
    ).not.toBeInTheDocument();

    mockedGetContent.mockResolvedValue(baseContent as never);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText(baseContent.title)).toBeInTheDocument();
  });

  it('renders the recording and its media once loaded', async () => {
    mockedGetContent.mockResolvedValue(baseContent as never);

    renderAt(`/practice/listening/${CONTENT_ID}/dictation`);

    expect(await screen.findByText(baseContent.title)).toBeInTheDocument();
    expect(screen.getByTestId('youtube-embed')).toHaveAttribute(
      'data-video-id',
      'rkZ6gzyg7yY',
    );
    // Attribution survives — embedding a third party's video obliges us to say
    // whose it is.
    expect(screen.getByRole('link', { name: /nature channel/i })).toHaveAttribute(
      'href',
      'https://example.com/source',
    );
  });
});

describe('ListeningContentPage — mode routing', () => {
  it('redirects the bare content URL to the first supported mode', async () => {
    mockedGetContent.mockResolvedValue(baseContent as never);

    renderAt(`/practice/listening/${CONTENT_ID}`);

    // Landing on Dictation is observable through its own controls.
    expect(await screen.findByPlaceholderText('Type what you hear')).toBeInTheDocument();
  });

  it('404s a mode the recording does not enable, rather than redirecting to another one', async () => {
    mockedGetContent.mockResolvedValue(baseContent as never);

    renderAt(`/practice/listening/${CONTENT_ID}/shadowing`);

    expect(
      await screen.findByText('This listening lesson could not be found.'),
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Type what you hear')).not.toBeInTheDocument();
  });

  // Sprint 11 Phase 3 replaced the placeholder panel with the recording layer.
  // jsdom has no MediaRecorder, so what renders here is the unsupported-browser
  // surface — which is itself the assertion worth keeping: the route serves a
  // real panel that degrades honestly rather than crashing.
  it('serves a supported Shadowing route with the recording panel', async () => {
    mockedGetContent.mockResolvedValue({
      ...baseContent,
      supportedModes: ['DICTATION', 'SHADOWING'],
    } as never);

    renderAt(`/practice/listening/${CONTENT_ID}/shadowing`);

    expect(await screen.findByText('Read this sentence aloud')).toBeInTheDocument();
    expect(screen.getByText('This browser cannot record audio.')).toBeInTheDocument();
    // The sentence list still works — listening and reading along is real practice.
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('offers a mode tab only for modes the recording enables', async () => {
    mockedGetContent.mockResolvedValue(baseContent as never);

    renderAt(`/practice/listening/${CONTENT_ID}/dictation`);
    await screen.findByText(baseContent.title);

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toHaveTextContent('Dictation');
  });

  it('a deep link straight to a mode works on first load', async () => {
    mockedGetContent.mockResolvedValue({
      ...baseContent,
      supportedModes: ['DICTATION', 'SHADOWING'],
    } as never);

    renderAt(`/practice/listening/${CONTENT_ID}/shadowing`);

    expect(await screen.findByText('Read this sentence aloud')).toBeInTheDocument();
  });
});

describe('ListeningContentPage — segments come from the backend', () => {
  it('drives the Dictation workspace from the server’s sentences', async () => {
    mockedGetContent.mockResolvedValue(baseContent as never);

    renderAt(`/practice/listening/${CONTENT_ID}/dictation`);
    await screen.findByPlaceholderText('Type what you hear');

    expect(screen.getByText('Question 1/2')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Type what you hear'), {
      target: { value: 'hi there' },
    });
    expect(screen.getByText(/Match: 100%/)).toBeInTheDocument();
  });

  it('selecting a sentence in the list makes it the current one', async () => {
    mockedGetContent.mockResolvedValue(baseContent as never);

    renderAt(`/practice/listening/${CONTENT_ID}/dictation`);
    await screen.findByPlaceholderText('Type what you hear');

    fireEvent.click(screen.getByRole('button', { name: 'Question 2' }));

    expect(screen.getByText('Question 2/2')).toBeInTheDocument();
  });

  it('selecting a sentence SEEKS THE MEDIA to its start and plays it', async () => {
    mockedGetContent.mockResolvedValue(baseContent as never);

    renderAt(`/practice/listening/${CONTENT_ID}/dictation`);
    await screen.findByPlaceholderText('Type what you hear');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Play' })).not.toBeDisabled(),
    );
    ytPlayer.seekTo.mockClear();
    ytPlayer.playVideo.mockClear();

    // Sentence 2 starts at 3000ms. A click is a user gesture, so playback here
    // is legitimate — the student asked for this sentence.
    fireEvent.click(screen.getByRole('button', { name: 'Question 2' }));

    await waitFor(() => expect(ytPlayer.seekTo).toHaveBeenCalledWith(3, true));
    expect(ytPlayer.playVideo).toHaveBeenCalled();
  });

  it('re-selecting the sentence already open replays it from its start', async () => {
    mockedGetContent.mockResolvedValue(baseContent as never);

    renderAt(`/practice/listening/${CONTENT_ID}/dictation`);
    await screen.findByPlaceholderText('Type what you hear');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Play' })).not.toBeDisabled(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Question 1' }));
    await waitFor(() => expect(ytPlayer.seekTo).toHaveBeenCalledWith(0, true));
    ytPlayer.seekTo.mockClear();

    // The index does not change, so only a play token can drive this.
    fireEvent.click(screen.getByRole('button', { name: 'Question 1' }));
    await waitFor(() => expect(ytPlayer.seekTo).toHaveBeenCalledWith(0, true));
  });

  it('states that progress IS saved, now that it is persisted server-side', async () => {
    mockedGetContent.mockResolvedValue(baseContent as never);

    renderAt(`/practice/listening/${CONTENT_ID}/dictation`);

    expect(await screen.findByText(/saved to your account/i)).toBeInTheDocument();
  });
});

describe('Dictation completion — every sentence, not just the last one', () => {
  /**
   * Type the sentence AND wait for the server to accept it.
   *
   * Sprint 11 Phase 4A: typing the last word no longer marks anything solved
   * on its own. The panel posts the attempt and waits for the verdict, so a
   * test that clicked Next immediately would race the request and see a
   * sentence that is still outstanding.
   */
  const solveCurrent = async (text: string) => {
    fireEvent.change(screen.getByPlaceholderText('Type what you hear'), {
      target: { value: text },
    });
    await waitFor(() => expect(mockedSubmit).toHaveBeenCalled(), { timeout: 3000 });
    await waitFor(
      () => expect(screen.getByRole('button', { name: 'Next >' })).not.toBeDisabled(),
      { timeout: 3000 },
    );
  };

  it('does NOT finish when the last sentence is solved but an earlier one is not', async () => {
    mockedGetContent.mockResolvedValue(baseContent as never);
    serverSolves();

    renderAt(`/practice/listening/${CONTENT_ID}/dictation`);
    await screen.findByPlaceholderText('Type what you hear');

    // Jump straight to the last sentence and solve only that one.
    fireEvent.click(screen.getByRole('button', { name: 'Question 2' }));
    await solveCurrent('second one now');
    fireEvent.click(screen.getByRole('button', { name: 'Next >' }));

    // No summary, and the student is taken to the sentence still outstanding.
    expect(screen.queryByText('Listening Complete')).not.toBeInTheDocument();
    expect(screen.getByText('Question 1/2')).toBeInTheDocument();
  });

  it('finishes only once every sentence is solved', async () => {
    mockedGetContent.mockResolvedValue(baseContent as never);
    serverSolves();

    renderAt(`/practice/listening/${CONTENT_ID}/dictation`);
    await screen.findByPlaceholderText('Type what you hear');

    fireEvent.click(screen.getByRole('button', { name: 'Question 2' }));
    await solveCurrent('second one now');
    fireEvent.click(screen.getByRole('button', { name: 'Next >' }));

    expect(screen.getByText('Question 1/2')).toBeInTheDocument();
    await solveCurrent('hi there');
    fireEvent.click(screen.getByRole('button', { name: 'Next >' }));

    expect(await screen.findByText('Listening Complete')).toBeInTheDocument();
  });

  it('the summary total reflects work actually done, never a positional claim', async () => {
    mockedGetContent.mockResolvedValue(baseContent as never);
    serverSolves();

    renderAt(`/practice/listening/${CONTENT_ID}/dictation`);
    await screen.findByPlaceholderText('Type what you hear');

    await solveCurrent('hi there');
    fireEvent.click(screen.getByRole('button', { name: 'Next >' }));
    await solveCurrent('second one now');
    fireEvent.click(screen.getByRole('button', { name: 'Next >' }));

    // Scoped to the summary card: the sentence list header also renders "2/2"
    // (position, not completion), and the two must not be confused.
    const summary = (await screen.findByText('Listening Complete')).closest(
      '.practice-fade-in',
    ) as HTMLElement;
    expect(within(summary).getByText('2/2')).toBeInTheDocument();
  });

  it('advancing in order still walks forward one sentence at a time', async () => {
    mockedGetContent.mockResolvedValue(baseContent as never);
    serverSolves();

    renderAt(`/practice/listening/${CONTENT_ID}/dictation`);
    await screen.findByPlaceholderText('Type what you hear');

    await solveCurrent('hi there');
    fireEvent.click(screen.getByRole('button', { name: 'Next >' }));

    expect(screen.getByText('Question 2/2')).toBeInTheDocument();
    expect(screen.queryByText('Listening Complete')).not.toBeInTheDocument();
  });

  // Sprint 11 Phase 3.4 — Next used to only select the next sentence; it now
  // plays it too, the same gesture as clicking a row in the sentence list.
  it('Next plays the sentence it lands on, not only selects it', async () => {
    mockedGetContent.mockResolvedValue(baseContent as never);
    serverSolves();

    renderAt(`/practice/listening/${CONTENT_ID}/dictation`);
    await screen.findByPlaceholderText('Type what you hear');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Play' })).not.toBeDisabled(),
    );
    ytPlayer.seekTo.mockClear();
    ytPlayer.playVideo.mockClear();

    await solveCurrent('hi there');
    fireEvent.click(screen.getByRole('button', { name: 'Next >' }));

    expect(screen.getByText('Question 2/2')).toBeInTheDocument();
    // Sentence 2 starts at 3000ms — the same seek+play a manual row click
    // would trigger, now fired automatically by Next.
    await waitFor(() => expect(ytPlayer.seekTo).toHaveBeenCalledWith(3, true));
    expect(ytPlayer.playVideo).toHaveBeenCalled();
  });
});

describe('ListeningContentPage — media providers', () => {
  it('renders an audio element for an EXTERNAL_URL audio recording', async () => {
    mockedGetContent.mockResolvedValue({
      ...baseContent,
      mediaType: 'AUDIO',
      mediaProvider: 'EXTERNAL_URL',
      mediaUrl: 'https://example.com/lesson.mp3',
    } as never);

    const { container } = renderAt(`/practice/listening/${CONTENT_ID}/dictation`);
    await screen.findByText(baseContent.title);

    const audio = container.querySelector('audio');
    expect(audio).not.toBeNull();
    expect(audio).toHaveAttribute('src', 'https://example.com/lesson.mp3');
    // Never autoplay — playback starts from a gesture on every provider.
    expect(audio).not.toHaveAttribute('autoplay');
    expect(screen.queryByTestId('youtube-embed')).not.toBeInTheDocument();
  });

  it('shows the unavailable surface when a published YouTube URL no longer parses', async () => {
    mockedGetContent.mockResolvedValue({
      ...baseContent,
      mediaUrl: 'https://example.com/not-a-youtube-link',
    } as never);

    renderAt(`/practice/listening/${CONTENT_ID}/dictation`);

    expect(
      await screen.findByText(/video couldn't be shown right now/i),
    ).toBeInTheDocument();
    // Practice must survive broken media: the sentences are still there.
    expect(screen.getByPlaceholderText('Type what you hear')).toBeInTheDocument();
  });

  it('disables the transport while no player is available', async () => {
    mockedGetContent.mockResolvedValue({
      ...baseContent,
      mediaUrl: 'https://example.com/not-a-youtube-link',
    } as never);

    renderAt(`/practice/listening/${CONTENT_ID}/dictation`);
    await screen.findByText(baseContent.title);

    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Replay' })).toBeDisabled();
  });

  it('builds the speed menu from what the provider reports it supports', async () => {
    mockedGetContent.mockResolvedValue(baseContent as never);

    renderAt(`/practice/listening/${CONTENT_ID}/dictation`);
    await screen.findByText(baseContent.title);

    // The provider publishes its controller a commit after the recording
    // renders, so the menu is asserted once it has — a plain read here would
    // catch the pre-provider default and prove nothing.
    await waitFor(() =>
      expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
        '0.5x',
        '1x',
        '2x',
      ]),
    );
  });

  it('enables the transport only once the provider is actually ready', async () => {
    mockedGetContent.mockResolvedValue(baseContent as never);

    renderAt(`/practice/listening/${CONTENT_ID}/dictation`);
    await screen.findByText(baseContent.title);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Play' })).not.toBeDisabled(),
    );
  });
});

// ---------------------------------------------------------------------------
// Sprint 11 Phase 4A — progress is the SERVER's, and so is the verdict.
// ---------------------------------------------------------------------------

describe('Dictation progress is server-authoritative', () => {
  const withProgress = (segments: unknown[]) => ({
    ...baseContent,
    dictationProgress: {
      totalSegments: 2,
      completedSegments: segments.length,
      completed: segments.length === 2,
      lastActivityAt: new Date().toISOString(),
      segments,
    },
  });

  // The whole point of the phase: before this, a reload started the recording
  // over because progress existed only in React state.
  it('rehydrates solved sentences from the server after a reload', async () => {
    mockedGetContent.mockResolvedValue(
      withProgress([
        {
          segmentId: 'seg-1',
          completedAt: new Date().toISOString(),
          bestAccuracyPercent: 100,
          attemptCount: 1,
          assisted: false,
        },
      ]) as never,
    );

    renderAt(`/practice/listening/${CONTENT_ID}/dictation`);
    await screen.findByPlaceholderText('Type what you hear');

    // Resumes ON the outstanding sentence, not back at the beginning —
    // "progress is not lost" has to mean the student returns to the work.
    expect(screen.getByText('Question 2/2')).toBeInTheDocument();
  });

  it('starts at the first sentence when nothing has been done', async () => {
    mockedGetContent.mockResolvedValue(withProgress([]) as never);

    renderAt(`/practice/listening/${CONTENT_ID}/dictation`);
    await screen.findByPlaceholderText('Type what you hear');

    expect(screen.getByText('Question 1/2')).toBeInTheDocument();
  });

  it('sends only what was typed — never a score', async () => {
    mockedGetContent.mockResolvedValue(baseContent as never);
    serverSolves();

    renderAt(`/practice/listening/${CONTENT_ID}/dictation`);
    await screen.findByPlaceholderText('Type what you hear');

    fireEvent.change(screen.getByPlaceholderText('Type what you hear'), {
      target: { value: 'hi there' },
    });
    await waitFor(() => expect(mockedSubmit).toHaveBeenCalled());

    const [, body] = mockedSubmit.mock.calls[0];
    // Deciding whether a student passed is not a decision a browser makes in
    // this codebase. If these ever appear, grading has moved to the client.
    expect(Object.keys(body).sort()).toEqual([
      'clientAttemptId',
      'revealedWordCount',
      'typedText',
    ]);
    expect(body.typedText).toBe('hi there');
  });

  // The divergence risk of this phase, made visible instead of silent: the
  // browser's live diff was satisfied and the server's canonical normalizer
  // was not.
  it('does NOT mark a sentence solved when the server rejects it', async () => {
    mockedGetContent.mockResolvedValue(baseContent as never);
    serverSolves({ solved: false, accuracyPercent: 87 });

    renderAt(`/practice/listening/${CONTENT_ID}/dictation`);
    await screen.findByPlaceholderText('Type what you hear');

    fireEvent.change(screen.getByPlaceholderText('Type what you hear'), {
      target: { value: 'hi there' },
    });

    expect(
      await screen.findByRole('alert', {}, { timeout: 3000 }),
    ).toHaveTextContent(/not accepted/i);
    // No summary, and no silent acceptance of work the server never recorded.
    expect(screen.queryByText('Listening Complete')).not.toBeInTheDocument();
  });

  // Sprint 08's lesson, applied here: a failed write is never optimistically
  // accepted and quietly lost. There is no session store left to fall back to.
  it('surfaces a failed submission with a retry, and keeps the sentence unsolved', async () => {
    mockedGetContent.mockResolvedValue(baseContent as never);
    mockedSubmit.mockRejectedValueOnce(new Error('Không lưu được câu trả lời của bạn.'));

    renderAt(`/practice/listening/${CONTENT_ID}/dictation`);
    await screen.findByPlaceholderText('Type what you hear');

    fireEvent.change(screen.getByPlaceholderText('Type what you hear'), {
      target: { value: 'hi there' },
    });

    const alert = await screen.findByRole('alert', {}, { timeout: 3000 });
    expect(alert).toHaveTextContent('Không lưu được câu trả lời của bạn.');

    serverSolves();
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(mockedSubmit).toHaveBeenCalledTimes(2);
  });

  it('does not offer a retry for an answer the server graded and refused', async () => {
    mockedGetContent.mockResolvedValue(baseContent as never);
    serverSolves({ solved: false });

    renderAt(`/practice/listening/${CONTENT_ID}/dictation`);
    await screen.findByPlaceholderText('Type what you hear');

    fireEvent.change(screen.getByPlaceholderText('Type what you hear'), {
      target: { value: 'hi there' },
    });

    const alert = await screen.findByRole('alert', {}, { timeout: 3000 });
    // Nothing to retry — the request succeeded. The student has to fix the
    // answer, and a Try again button would just repeat the same rejection.
    expect(within(alert).queryByRole('button')).not.toBeInTheDocument();
  });
});
