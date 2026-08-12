import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import PlacementAudioPlayer from './PlacementAudioPlayer';
import * as tts from '../../services/tts';

const renderPlayer = (audioUrl: string | null, transcript: string | null = null) =>
  render(
    <LanguageProvider>
      <PlacementAudioPlayer audioUrl={audioUrl} transcript={transcript} />
    </LanguageProvider>,
  );

const getAudioEl = () =>
  screen.getByTestId('placement-audio-element') as HTMLAudioElement;

describe('PlacementAudioPlayer — recorded audio (audioUrl present)', () => {
  beforeEach(() => {
    // Same convention as FlashcardSession.test.tsx: jsdom's real play/pause
    // are unimplemented no-ops, so real playback is spied rather than
    // mocked-away entirely.
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('is paused on mount and shows the play button', () => {
    renderPlayer('https://example.com/clip.mp3');
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(window.HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it('play/pause toggles the underlying audio element and the button label', async () => {
    const user = userEvent.setup();
    renderPlayer('https://example.com/clip.mp3');

    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('shows a live time label driven by the real audio element, not a fake clock', () => {
    renderPlayer('https://example.com/clip.mp3');
    const audio = getAudioEl();

    expect(screen.getByText('0:00 / 0:00')).toBeInTheDocument();

    Object.defineProperty(audio, 'duration', { value: 42, configurable: true });
    fireEvent.loadedMetadata(audio);
    Object.defineProperty(audio, 'currentTime', { value: 7, configurable: true });
    fireEvent.timeUpdate(audio);

    expect(screen.getByText('0:07 / 0:42')).toBeInTheDocument();
  });

  it('replay resets playback to 0:00 and plays, even mid-playback', async () => {
    const user = userEvent.setup();
    renderPlayer('https://example.com/clip.mp3');
    const audio = getAudioEl();

    Object.defineProperty(audio, 'duration', { value: 42, configurable: true });
    fireEvent.loadedMetadata(audio);
    Object.defineProperty(audio, 'currentTime', { value: 30, configurable: true, writable: true });
    fireEvent.timeUpdate(audio);
    expect(screen.getByText('0:30 / 0:42')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /nghe lại|replay/i }));

    expect(audio.currentTime).toBe(0);
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
    expect(screen.getByText('0:00 / 0:42')).toBeInTheDocument();
  });

  it('pauses the audio element on unmount — no audio may keep playing after its question is gone', async () => {
    const user = userEvent.setup();
    const { unmount } = renderPlayer('https://example.com/clip.mp3');

    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);

    unmount();

    expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it('prefers the real recording over transcript-based TTS when both are present', () => {
    renderPlayer('https://example.com/clip.mp3', 'A: "Hi." B: "Hello."');
    expect(screen.getByTestId('placement-audio-element')).toBeInTheDocument();
  });
});

// No recording exists yet — the dialogue is read aloud client-side via the
// browser's Web Speech API (services/tts.ts) instead of a bare <audio>
// element. The transcript text itself must never appear on screen.
describe('PlacementAudioPlayer — spoken transcript (no audioUrl, browser TTS)', () => {
  const TRANSCRIPT = 'A: "Excuse me, where is the nearest bus stop?" B: "It\'s just around the corner."';

  beforeEach(() => {
    vi.spyOn(tts, 'isTtsSupported').mockReturnValue(true);
    vi.spyOn(tts, 'speakText').mockReturnValue(true);
    vi.spyOn(tts, 'cancelSpeech').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('never renders the transcript text — only reads it aloud', () => {
    renderPlayer(null, TRANSCRIPT);
    expect(screen.queryByText(TRANSCRIPT)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('speaks the transcript and flips to the Pause label on Play', async () => {
    const user = userEvent.setup();
    renderPlayer(null, TRANSCRIPT);

    await user.click(screen.getByRole('button', { name: 'Play' }));

    expect(tts.speakText).toHaveBeenCalledWith(TRANSCRIPT, expect.objectContaining({
      onEnd: expect.any(Function),
      onError: expect.any(Function),
    }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('onEnd flips back to the Play label without needing a manual pause', async () => {
    const user = userEvent.setup();
    renderPlayer(null, TRANSCRIPT);

    await user.click(screen.getByRole('button', { name: 'Play' }));
    const onEnd = vi.mocked(tts.speakText).mock.calls[0][1]?.onEnd;
    expect(onEnd).toBeTruthy();

    act(() => onEnd!());

    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('Pause cancels the in-flight utterance rather than leaving it running', async () => {
    const user = userEvent.setup();
    renderPlayer(null, TRANSCRIPT);

    await user.click(screen.getByRole('button', { name: 'Play' }));
    await user.click(screen.getByRole('button', { name: 'Pause' }));

    expect(tts.cancelSpeech).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('replay cancels any current speech and speaks again from the start', async () => {
    const user = userEvent.setup();
    renderPlayer(null, TRANSCRIPT);

    await user.click(screen.getByRole('button', { name: 'Play' }));
    vi.mocked(tts.speakText).mockClear();
    await user.click(screen.getByRole('button', { name: /nghe lại|replay/i }));

    expect(tts.cancelSpeech).toHaveBeenCalled();
    expect(tts.speakText).toHaveBeenCalledTimes(1);
  });

  it('cancels speech on unmount — no audio may keep playing after its question is gone', async () => {
    const user = userEvent.setup();
    const { unmount } = renderPlayer(null, TRANSCRIPT);

    await user.click(screen.getByRole('button', { name: 'Play' }));
    vi.mocked(tts.cancelSpeech).mockClear();
    unmount();

    expect(tts.cancelSpeech).toHaveBeenCalled();
  });

  it('shows an unsupported message and no interactive controls when the browser lacks speech synthesis', () => {
    vi.mocked(tts.isTtsSupported).mockReturnValue(false);
    renderPlayer(null, TRANSCRIPT);

    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
    expect(
      screen.getByText('Your browser does not support audio playback for this question.'),
    ).toBeInTheDocument();
  });
});
