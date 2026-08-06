import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import ShadowingModePanel from './ShadowingModePanel';
import { PREFLIGHT_DURATION_MS } from './recording/useMicrophonePreflight';
import {
  installRecordingMocks,
  restoreRecordingMocks,
  FakeMediaRecorder,
  FakeSpeechRecognition,
  FakeAudioContext,
  RecordingMocks,
} from './recording/testDoubles';

// Sprint 11 Phase 3 — the recording layer as a student meets it.
//
// This renders the panel through a real <Outlet> with a hand-built context
// rather than mounting ListeningContentPage, so a failure here is about the
// recording UI and not about content loading, routing or the YouTube embed —
// all three of which already have their own suite.
//
// `pauseMedia` is a spy for the same reason it exists: silencing the player
// before the microphone opens is a behaviour, and behaviours get asserted.

const pauseMedia = vi.fn();
const replaySegment = vi.fn();

const SEGMENTS = [
  {
    id: 'seg-1',
    orderIndex: 0,
    text: 'The otter wraps her baby in kelp.',
    ipa: 'ˈɒtə',
    translationVi: 'Rái cá quấn con mình trong rong biển.',
    startTimeMs: 0,
    endTimeMs: 4000,
  },
  {
    id: 'seg-2',
    orderIndex: 1,
    text: 'It keeps the pup from drifting away.',
    ipa: null,
    translationVi: 'Điều đó giữ cho con non không trôi đi.',
    startTimeMs: 4000,
    endTimeMs: 8000,
  },
];

let currentIndex = 0;
let mocks: RecordingMocks;

const Host: React.FC = () => (
  <Outlet
    context={{
      content: {
        id: 'c1',
        title: 'Otter Moms',
        level: 'B1',
        category: { id: 'k', name: 'Animals', nameVi: 'Động vật', orderIndex: 0 },
        supportedModes: ['SHADOWING'],
        segments: SEGMENTS,
      },
      currentIndex,
      goToSegment: vi.fn(),
      isPlaying: false,
      togglePlay: vi.fn(),
      replaySegment,
      pauseMedia,
      mediaAvailable: true,
      solvedSegmentIds: new Set<string>(),
      setSolvedSegmentIds: vi.fn(),
      assistedSegmentIds: new Set<string>(),
      setAssistedSegmentIds: vi.fn(),
      setStudyActive: vi.fn(),
    }}
  />
);

const renderPanel = () =>
  render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={['/x/shadowing']}>
          <Routes>
            <Route path="/x" element={<Host />}>
              <Route path="shadowing" element={<ShadowingModePanel />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </ThemeProvider>,
  );

const flush = async () => {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
};

const clickAndFlush = async (name: RegExp) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
    await flush();
  });
};

// Phase 3.1 put two steps in front of the Record button, and they are the
// point of the phase: grant permission (which is what unlocks device names),
// then prove the chosen microphone can actually be heard. Every test that
// records now goes through them, which is itself the guarantee that a student
// cannot skip them either.
const completeSetup = async () => {
  await clickAndFlush(/set up microphone/i);
  await clickAndFlush(/^test microphone$/i);
  await act(async () => {
    vi.advanceTimersByTime(PREFLIGHT_DURATION_MS + 100);
    await flush();
  });
};

beforeEach(() => {
  currentIndex = 0;
  localStorage.clear();
  // The microphone preference is keyed per user, so the panel needs one.
  localStorage.setItem('user', JSON.stringify({ id: 'u-1', role: 'USER' }));
  mocks = installRecordingMocks();
  vi.clearAllMocks();
  // Fake timers for the whole suite: the microphone preflight runs for
  // PREFLIGHT_DURATION_MS, and no test should wait 2.5 real seconds to reach
  // the Record button.
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  restoreRecordingMocks();
  vi.restoreAllMocks();
});

describe('ShadowingModePanel — the sentence', () => {
  it('shows the sentence, because reading it aloud is the exercise', () => {
    renderPanel();

    expect(screen.getByText('Read this sentence aloud')).toBeInTheDocument();
    expect(screen.getByText(SEGMENTS[0].text)).toBeInTheDocument();
    expect(screen.getByText('/ˈɒtə/')).toBeInTheDocument();
  });

  it('offers a way to hear the sentence before recording', () => {
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /listen first/i }));

    expect(replaySegment).toHaveBeenCalledTimes(1);
  });
});

describe('ShadowingModePanel — record, stop, replay, retry', () => {
  // The state appears twice on purpose: once as a visible badge and once in an
  // sr-only live region, because the transition happens while the student is
  // reading the sentence rather than watching the button. Asserting through
  // `role="status"` pins the announcement, not just the pixels.
  it('starts at Ready with a Record button and nothing to play back', () => {
    renderPanel();

    expect(screen.getByTestId('recorder-status')).toHaveTextContent('Ready to record');
    expect(screen.getByRole('button', { name: /^record$/i })).toBeInTheDocument();
    expect(screen.queryByTestId('recording-playback-audio')).not.toBeInTheDocument();
  });

  it('records on a click and swaps Record for Stop', async () => {
    renderPanel();

    await completeSetup();
    await clickAndFlush(/^record$/i);

    // Three opens, one per step, and each is closed before the next: the
    // permission probe that unlocks device names, the preflight, and the
    // recording itself. They are separate on purpose — holding the first two
    // open would keep the OS microphone indicator lit while the student is
    // still reading a list of device names.
    expect(mocks.getUserMedia).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^record$/i })).not.toBeInTheDocument();
    expect(screen.getAllByText('Recording').length).toBeGreaterThan(0);
  });

  // Conservative until Phase 0's bleed measurement exists: pausing is safe
  // whichever way that measurement lands.
  it('silences the player before opening the microphone', async () => {
    renderPanel();

    await completeSetup();
    await clickAndFlush(/^record$/i);

    expect(pauseMedia).toHaveBeenCalledTimes(1);
  });

  it('offers playback of the recording after Stop', async () => {
    renderPanel();
    await completeSetup();
    await clickAndFlush(/^record$/i);

    await clickAndFlush(/stop/i);

    expect(screen.getByTestId('recording-playback-audio')).toHaveAttribute(
      'src',
      expect.stringMatching(/^blob:/),
    );
    expect(screen.getByRole('button', { name: /replay/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /record again/i })).toBeInTheDocument();
  });

  it('replays the recording from the beginning, not from where it was left', async () => {
    renderPanel();
    await completeSetup();
    await clickAndFlush(/^record$/i);
    await clickAndFlush(/stop/i);

    const audio = screen.getByTestId('recording-playback-audio') as HTMLAudioElement;
    audio.currentTime = 2.5;
    // jsdom's HTMLMediaElement.play is not implemented; a stub is enough to
    // observe that replay asked for playback at all.
    audio.play = vi.fn(() => Promise.resolve());

    fireEvent.click(screen.getByRole('button', { name: /replay/i }));

    expect(audio.currentTime).toBe(0);
    expect(audio.play).toHaveBeenCalled();
  });

  it('discards the recording on Record again and returns to Ready', async () => {
    renderPanel();
    await completeSetup();
    await clickAndFlush(/^record$/i);
    await clickAndFlush(/stop/i);

    await clickAndFlush(/record again/i);

    expect(mocks.revokeObjectURL).toHaveBeenCalled();
    expect(screen.queryByTestId('recording-playback-audio')).not.toBeInTheDocument();
    expect(screen.getByTestId('recorder-status')).toHaveTextContent('Ready to record');
    expect(screen.getByRole('button', { name: /^record$/i })).toBeInTheDocument();
  });
});

describe('ShadowingModePanel — transcript', () => {
  // Live transcription is off since browser QA found it silences Chrome's
  // recording. An empty "What the browser heard" panel that never fills would
  // read as a broken feature, so the panel is replaced by the reason.
  it('explains that live transcription is off instead of showing a panel that stays empty', async () => {
    renderPanel();
    await completeSetup();
    await clickAndFlush(/^record$/i);

    expect(screen.queryByText('What the browser heard')).not.toBeInTheDocument();
    expect(
      screen.getByText(/live speech recognition is off while recording/i),
    ).toBeInTheDocument();
  });

  // The warning exists so a student learns their microphone is delivering
  // nothing WHILE they can still fix it, rather than after reading a sentence
  // aloud for a file that turns out to be silent.
  it('warns during the recording when no sound is reaching the microphone', async () => {
    renderPanel();
    await completeSetup();
    // Silence only AFTER the preflight has passed, so this is the recorder's
    // own live warning rather than the preflight's verdict leaking through.
    FakeAudioContext.sampleAmplitude = 0;
    await clickAndFlush(/^record$/i);
    await act(async () => {
      vi.advanceTimersByTime(2_000);
      await flush();
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No sound is reaching the microphone.',
    );
  });

  it('shows no such warning when the microphone is delivering audio', async () => {
    renderPanel();
    await completeSetup();
    await clickAndFlush(/^record$/i);
    await act(async () => {
      vi.advanceTimersByTime(2_000);
      await flush();
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('never constructs a recogniser, so it cannot take the microphone', async () => {
    renderPanel();

    await completeSetup();
    await clickAndFlush(/^record$/i);

    expect(FakeSpeechRecognition.instances).toHaveLength(0);
  });

  // The absence is the guarantee. If any of these ever appears, grading has
  // moved to the client — which is the one thing Phase 3 must not do. Kept
  // through the transcript's removal precisely because it is not about the
  // transcript: it is about what this panel is forbidden to compute.
  it('renders no accuracy, no score and no pass verdict', async () => {
    renderPanel();
    await completeSetup();
    await clickAndFlush(/^record$/i);
    await clickAndFlush(/stop/i);

    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/accuracy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bscore\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bpassed\b/i)).not.toBeInTheDocument();
  });

  it('tells the student their recording is not uploaded or saved', () => {
    renderPanel();

    expect(
      screen.getByText(/not uploaded, scored or saved to your account/i),
    ).toBeInTheDocument();
  });

  // Firefox used to be told its browser could not transcribe. That sentence is
  // now a lie by implication — no browser transcribes here — and telling one
  // set of users their browser is the problem when the app declined the feature
  // for everyone sends them to fix something that is not broken.
  it('does not blame a browser that has no recogniser for a feature nobody gets', () => {
    restoreRecordingMocks();
    mocks = installRecordingMocks({ withoutSpeechRecognition: true });
    renderPanel();

    expect(screen.queryByText('What the browser heard')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/cannot transcribe speech/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/live speech recognition is off while recording/i),
    ).toBeInTheDocument();
  });
});

describe('ShadowingModePanel — failures each say their own thing', () => {
  it('gives instructions, not an apology, when the microphone is blocked', async () => {
    restoreRecordingMocks();
    mocks = installRecordingMocks({ denyWith: 'NotAllowedError' });
    renderPanel();

    await clickAndFlush(/set up microphone/i);

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Microphone access is blocked for this site.');
    expect(dialog).toHaveTextContent('Set Microphone to Allow.');
    // A dead Record button under the instructions would only invite another
    // failed press.
    expect(screen.queryByRole('button', { name: /^record$/i })).not.toBeInTheDocument();
  });

  it('names a busy device as busy rather than as a permission problem', async () => {
    restoreRecordingMocks();
    mocks = installRecordingMocks({ denyWith: 'NotReadableError' });
    renderPanel();

    await clickAndFlush(/set up microphone/i);

    expect(screen.getByText(/in use by another app/i)).toBeInTheDocument();
    expect(screen.queryByText(/access is blocked/i)).not.toBeInTheDocument();
  });

  it('names a missing device as missing', async () => {
    restoreRecordingMocks();
    mocks = installRecordingMocks({ denyWith: 'NotFoundError' });
    renderPanel();

    await clickAndFlush(/set up microphone/i);

    expect(screen.getByText(/No microphone was found/i)).toBeInTheDocument();
  });

  it('blames the connection, not the browser, outside a secure context', () => {
    restoreRecordingMocks();
    mocks = installRecordingMocks({ withoutMediaRecorder: true });
    Object.defineProperty(window, 'isSecureContext', {
      value: false,
      configurable: true,
    });
    renderPanel();

    expect(screen.getByText(/needs a secure \(https\) connection/i)).toBeInTheDocument();
  });

  it('says the browser cannot record when it genuinely cannot', () => {
    restoreRecordingMocks();
    mocks = installRecordingMocks({ withoutMediaRecorder: true });
    renderPanel();

    expect(screen.getByText('This browser cannot record audio.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^record$/i })).not.toBeInTheDocument();
    // The sentence is still readable, so the page has not become useless.
    expect(screen.getByText(SEGMENTS[0].text)).toBeInTheDocument();
  });

  it('reports a withdrawn permission distinctly from a refused one', async () => {
    renderPanel();
    await completeSetup();
    await clickAndFlush(/^record$/i);

    await act(async () => {
      mocks.track.onended?.();
      await flush();
    });

    expect(screen.getByText(/withdrawn while recording/i)).toBeInTheDocument();
  });
});

describe('ShadowingModePanel — cleanup', () => {
  it('releases the microphone when the student navigates away', async () => {
    const view = renderPanel();
    await completeSetup();
    await clickAndFlush(/^record$/i);

    view.unmount();

    expect(mocks.track.stop).toHaveBeenCalled();
    expect(FakeMediaRecorder.latest().state).toBe('inactive');
  });

  it('revokes the recording URL when the student navigates away', async () => {
    const view = renderPanel();
    await completeSetup();
    await clickAndFlush(/^record$/i);
    await clickAndFlush(/stop/i);

    view.unmount();

    expect(mocks.revokeObjectURL).toHaveBeenCalled();
  });

  // A recording of sentence 2 played back on sentence 4, with nothing on screen
  // saying which was which, is worse than no recording.
  it('discards the recording when the student moves to another sentence', async () => {
    const view = renderPanel();
    await completeSetup();
    await clickAndFlush(/^record$/i);
    await clickAndFlush(/stop/i);
    expect(screen.getByTestId('recording-playback-audio')).toBeInTheDocument();

    currentIndex = 1;
    await act(async () => {
      view.rerender(
        <ThemeProvider>
          <LanguageProvider>
            <MemoryRouter initialEntries={['/x/shadowing']}>
              <Routes>
                <Route path="/x" element={<Host />}>
                  <Route path="shadowing" element={<ShadowingModePanel />} />
                </Route>
              </Routes>
            </MemoryRouter>
          </LanguageProvider>
        </ThemeProvider>,
      );
      await flush();
    });

    expect(screen.getByText(SEGMENTS[1].text)).toBeInTheDocument();
    expect(screen.queryByTestId('recording-playback-audio')).not.toBeInTheDocument();
    expect(mocks.revokeObjectURL).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Sprint 11 Phase 3.1 — the microphone setup flow, as a student meets it.
//
// Root cause, verified in a real browser: Chrome selected a "Voice Changer
// Virtual Audio Device (WDM)" as the default input. The stream opened, the
// track was live, the timer counted, and every sample was silence. Switching to
// "Microphone (Realtek(R) Audio)" fixed it. Nothing was wrong with
// MediaRecorder or the analyser — the app simply had no way to say which device
// it was using, and no way to choose another.
//
// The default device fixture reproduces exactly that machine.
// ---------------------------------------------------------------------------

describe('ShadowingModePanel — microphone setup', () => {
  it('asks for no permission until the student asks for it', () => {
    renderPanel();

    expect(mocks.getUserMedia).not.toHaveBeenCalled();
    expect(mocks.enumerateDevices).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: /set up microphone/i }),
    ).toBeInTheDocument();
  });

  it('cannot record before a microphone has been set up', () => {
    renderPanel();

    expect(screen.getByRole('button', { name: /^record$/i })).toBeDisabled();
  });

  it('lists the real inputs after permission, and hides the speakers', async () => {
    renderPanel();

    await clickAndFlush(/set up microphone/i);

    const select = screen.getByLabelText('Microphone') as HTMLSelectElement;
    const options = Array.from(select.options).map((option) => option.textContent);
    expect(options.some((label) => label?.includes('Realtek(R) Audio)'))).toBe(true);
    expect(options.some((label) => label?.includes('Speakers'))).toBe(false);
  });

  // The device that caused the bug must still be listed. Filtering by name
  // would be guessing, and the preflight measures the answer instead.
  it('still offers the virtual audio device rather than hiding it', async () => {
    renderPanel();

    await clickAndFlush(/set up microphone/i);

    const select = screen.getByLabelText('Microphone') as HTMLSelectElement;
    expect(
      Array.from(select.options).some((option) =>
        option.textContent?.includes('Voice Changer'),
      ),
    ).toBe(true);
  });

  it('names the microphone in use, so a wrong one is visible', async () => {
    renderPanel();

    await clickAndFlush(/set up microphone/i);

    expect(screen.getByText(/^Using:/)).toBeInTheDocument();
    expect(
      screen.getByText('Voice Changer Virtual Audio Device (WDM)'),
    ).toBeInTheDocument();
  });

  it('never renders a raw deviceId', async () => {
    renderPanel();

    await clickAndFlush(/set up microphone/i);

    expect(document.body.textContent).not.toContain('realtek-1');
  });

  it('records from the exact device the student chose', async () => {
    renderPanel();
    await clickAndFlush(/set up microphone/i);

    fireEvent.change(screen.getByLabelText('Microphone'), {
      target: { value: 'realtek-1' },
    });
    await clickAndFlush(/^test microphone$/i);
    await act(async () => {
      vi.advanceTimersByTime(PREFLIGHT_DURATION_MS + 100);
      await flush();
    });
    await clickAndFlush(/^record$/i);

    expect(mocks.getUserMedia).toHaveBeenLastCalledWith({
      audio: expect.objectContaining({ deviceId: { exact: 'realtek-1' } }),
    });
  });

  it('remembers the choice for next time, under a per-user key', async () => {
    renderPanel();
    await clickAndFlush(/set up microphone/i);

    fireEvent.change(screen.getByLabelText('Microphone'), {
      target: { value: 'realtek-1' },
    });

    expect(localStorage.getItem('engmasterai:preferred-microphone:u-1')).toBe(
      'realtek-1',
    );
  });
});

describe('ShadowingModePanel — the preflight', () => {
  it('refuses to record until the microphone has proved it can be heard', async () => {
    renderPanel();
    await clickAndFlush(/set up microphone/i);

    expect(screen.getByRole('button', { name: /^record$/i })).toBeDisabled();
    expect(screen.getByText(/test the microphone before recording/i)).toBeInTheDocument();
  });

  it('enables recording once a signal is detected', async () => {
    renderPanel();
    await completeSetup();

    expect(screen.getByText('Microphone is working.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^record$/i })).toBeEnabled();
  });

  // THE WHOLE PHASE, IN ONE TEST. The virtual device opens cleanly and returns
  // silence; the student must be told so before they read a sentence into it,
  // and must still not be allowed to record.
  it('reports a silent device and keeps recording disabled', async () => {
    FakeAudioContext.sampleAmplitude = 0;
    renderPanel();
    await completeSetup();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No sound was detected from this microphone.',
    );
    expect(screen.getByRole('button', { name: /^record$/i })).toBeDisabled();
  });

  it('tells the student to try another input when one is silent', async () => {
    FakeAudioContext.sampleAmplitude = 0;
    renderPanel();
    await completeSetup();

    expect(screen.getByText(/voice changer.*often produces no sound/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /test again/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /choose another microphone/i }),
    ).toBeInTheDocument();
  });

  // A verdict belongs to the device it was measured on.
  it('drops a passed verdict when the student switches microphone', async () => {
    renderPanel();
    await completeSetup();
    expect(screen.getByRole('button', { name: /^record$/i })).toBeEnabled();

    fireEvent.change(screen.getByLabelText('Microphone'), {
      target: { value: 'realtek-1' },
    });

    expect(screen.getByRole('button', { name: /^record$/i })).toBeDisabled();
  });

  // Gating on a check that physically cannot run would lock these students out
  // of the feature over a verdict nobody ever reached.
  it('does not gate recording on a browser that cannot measure at all', async () => {
    restoreRecordingMocks();
    mocks = installRecordingMocks({ withoutAudioContext: true });
    renderPanel();
    await clickAndFlush(/set up microphone/i);
    await clickAndFlush(/^test microphone$/i);
    await act(async () => {
      vi.advanceTimersByTime(PREFLIGHT_DURATION_MS + 100);
      await flush();
    });

    expect(screen.getByText(/cannot test the microphone in advance/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^record$/i })).toBeEnabled();
  });
});

describe('ShadowingModePanel — hardware that comes and goes', () => {
  it('says so when the remembered microphone is no longer connected', async () => {
    localStorage.setItem('engmasterai:preferred-microphone:u-1', 'usb-unplugged');
    renderPanel();

    await clickAndFlush(/set up microphone/i);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The microphone you used before is no longer connected.',
    );
    // And it must NOT have silently fallen through to the virtual device.
    expect(screen.getByRole('button', { name: /^record$/i })).toBeDisabled();
    expect(localStorage.getItem('engmasterai:preferred-microphone:u-1')).toBeNull();
  });

  it('stops a recording when the microphone in use is unplugged', async () => {
    localStorage.setItem('engmasterai:preferred-microphone:u-1', 'realtek-1');
    renderPanel();
    await completeSetup();
    await clickAndFlush(/^record$/i);
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();

    mocks.setDevices([{ kind: 'audioinput', deviceId: 'default', label: 'Built-in' }]);
    await act(async () => {
      mocks.emitDeviceChange();
      await flush();
    });

    // Capture stopped, device released, nothing offered as a recording.
    expect(mocks.track.stop).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /stop/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('recording-playback-audio')).not.toBeInTheDocument();
  });

  it('cannot be reconfigured mid-recording', async () => {
    renderPanel();
    await completeSetup();
    await clickAndFlush(/^record$/i);

    // The chooser is gone entirely while capture is running — swapping the
    // input under a live recorder is not something this supports.
    expect(screen.queryByLabelText('Microphone')).not.toBeInTheDocument();
  });

  it('removes its devicechange listener when the student leaves', async () => {
    const view = renderPanel();
    await clickAndFlush(/set up microphone/i);
    expect(mocks.deviceChangeListenerCount()).toBe(1);

    view.unmount();

    expect(mocks.deviceChangeListenerCount()).toBe(0);
  });
});
