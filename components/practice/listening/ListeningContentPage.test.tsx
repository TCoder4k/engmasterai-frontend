import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import ListeningContentPage from './ListeningContentPage';
import DictationModePanel from './DictationModePanel';
import ShadowingModePanel from './ShadowingModePanel';
import { getListeningContent } from '../../../services/listeningService';
import { ApiError } from '../../../services/apiError';

vi.mock('../../../services/listeningService', () => ({
  getListeningContent: vi.fn(),
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

  it('serves a supported Shadowing route with an honest not-yet-available panel', async () => {
    mockedGetContent.mockResolvedValue({
      ...baseContent,
      supportedModes: ['DICTATION', 'SHADOWING'],
    } as never);

    renderAt(`/practice/listening/${CONTENT_ID}/shadowing`);

    expect(await screen.findByText(/Shadowing practice is not available yet/)).toBeInTheDocument();
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

    expect(await screen.findByText(/Shadowing practice is not available yet/)).toBeInTheDocument();
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

  it('states that nothing is saved, because no Listening progress is persisted yet', async () => {
    mockedGetContent.mockResolvedValue(baseContent as never);

    renderAt(`/practice/listening/${CONTENT_ID}/dictation`);

    expect(await screen.findByText(/kept for this session only/i)).toBeInTheDocument();
  });
});

describe('Dictation completion — every sentence, not just the last one', () => {
  const solveCurrent = (text: string) => {
    fireEvent.change(screen.getByPlaceholderText('Type what you hear'), {
      target: { value: text },
    });
  };

  it('does NOT finish when the last sentence is solved but an earlier one is not', async () => {
    mockedGetContent.mockResolvedValue(baseContent as never);

    renderAt(`/practice/listening/${CONTENT_ID}/dictation`);
    await screen.findByPlaceholderText('Type what you hear');

    // Jump straight to the last sentence and solve only that one.
    fireEvent.click(screen.getByRole('button', { name: 'Question 2' }));
    solveCurrent('second one now');
    fireEvent.click(screen.getByRole('button', { name: 'Next >' }));

    // No summary, and the student is taken to the sentence still outstanding.
    expect(screen.queryByText('Listening Complete')).not.toBeInTheDocument();
    expect(screen.getByText('Question 1/2')).toBeInTheDocument();
  });

  it('finishes only once every sentence is solved', async () => {
    mockedGetContent.mockResolvedValue(baseContent as never);

    renderAt(`/practice/listening/${CONTENT_ID}/dictation`);
    await screen.findByPlaceholderText('Type what you hear');

    fireEvent.click(screen.getByRole('button', { name: 'Question 2' }));
    solveCurrent('second one now');
    fireEvent.click(screen.getByRole('button', { name: 'Next >' }));

    expect(screen.getByText('Question 1/2')).toBeInTheDocument();
    solveCurrent('hi there');
    fireEvent.click(screen.getByRole('button', { name: 'Next >' }));

    expect(await screen.findByText('Listening Complete')).toBeInTheDocument();
  });

  it('the summary total reflects work actually done, never a positional claim', async () => {
    mockedGetContent.mockResolvedValue(baseContent as never);

    renderAt(`/practice/listening/${CONTENT_ID}/dictation`);
    await screen.findByPlaceholderText('Type what you hear');

    solveCurrent('hi there');
    fireEvent.click(screen.getByRole('button', { name: 'Next >' }));
    solveCurrent('second one now');
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

    renderAt(`/practice/listening/${CONTENT_ID}/dictation`);
    await screen.findByPlaceholderText('Type what you hear');

    solveCurrent('hi there');
    fireEvent.click(screen.getByRole('button', { name: 'Next >' }));

    expect(screen.getByText('Question 2/2')).toBeInTheDocument();
    expect(screen.queryByText('Listening Complete')).not.toBeInTheDocument();
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
