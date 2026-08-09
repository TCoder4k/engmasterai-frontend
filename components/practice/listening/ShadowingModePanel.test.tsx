import React, { useRef, useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import ShadowingModePanel from './ShadowingModePanel';
import { PREFLIGHT_DURATION_MS } from './recording/useMicrophonePreflight';
import { SILENCE_VERDICT_AFTER_MS } from './recording/useRecorder';
import {
  submitShadowingAttempt,
  requestShadowingFeedback,
} from '../../../services/listeningService';
import type { SubmitShadowingAttemptResult } from '../../../services/listeningService';
import { ApiError, AuthExpiredError } from '../../../services/apiError';

// Phase 4B — the network is mocked at the SERVICE boundary, not at `fetch`.
// The panel's contract is "what did it send and what did it do with the
// answer"; the multipart body itself is the service's contract and is covered
// by the backend e2e, which exercises a real HTTP request end to end.
vi.mock('../../../services/listeningService', async () => {
  const actual = await vi.importActual<
    typeof import('../../../services/listeningService')
  >('../../../services/listeningService');
  return {
    ...actual,
    submitShadowingAttempt: vi.fn(),
    requestShadowingFeedback: vi.fn(),
  };
});
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

// Stateful, not a plain object literal — Next/completion tests need
// `goToSegmentAndPlay` to actually move `currentIndex` and
// `shadowingCompletedSegmentIds` to actually accumulate, the same way the
// real ListeningContentPage does. The `currentIndex` module variable is kept
// as the external override existing tests already use (set it, then
// `view.rerender(...)`) — the ref-compare below adopts it into local state
// on the next render without disturbing Next-driven internal changes, which
// never touch the module variable.
const Host: React.FC = () => {
  const [index, setIndex] = useState(currentIndex);
  const [shadowingCompletedSegmentIds, setShadowingCompletedSegmentIds] = useState<
    Set<string>
  >(new Set());
  const lastExternalIndexRef = useRef(currentIndex);
  if (lastExternalIndexRef.current !== currentIndex) {
    lastExternalIndexRef.current = currentIndex;
    setIndex(currentIndex);
  }

  return (
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
        currentIndex: index,
        goToSegment: (next: number) => setIndex(next),
        goToSegmentAndPlay: (next: number) => setIndex(next),
        isPlaying: false,
        togglePlay: vi.fn(),
        replaySegment,
        pauseMedia,
        mediaAvailable: true,
        loop: false,
        setLoop: vi.fn(),
        playbackRate: 1,
        availableRates: [0.5, 0.75, 1, 1.25, 1.5],
        setPlaybackRate: vi.fn(),
        solvedSegmentIds: new Set<string>(),
        setSolvedSegmentIds: vi.fn(),
        assistedSegmentIds: new Set<string>(),
        setAssistedSegmentIds: vi.fn(),
        shadowingCompletedSegmentIds,
        setShadowingCompletedSegmentIds,
        setStudyActive: vi.fn(),
      }}
    />
  );
};

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
  // Flushed BEFORE the click too, not only after: Phase 3.2's silent mount
  // probe means the button a test is about to look for may not exist in the
  // very first synchronous render — `renderPanel()` does not itself wait for
  // it. The flush and the DOM query are in SEPARATE `act()` calls on purpose:
  // a `setState` that lands from a floating promise (this probe is exactly
  // that — started on mount, resolved on its own schedule) is only guaranteed
  // committed once the `act()` callback that let it resolve has itself
  // returned. Querying `getByRole` from inside that same still-open callback
  // read a DOM that had not caught up yet, even though the state had already
  // changed — this is what broke every test through the setup step until it
  // was split like this.
  await act(async () => {
    await flush();
  });
  fireEvent.click(screen.getByRole('button', { name }));
  await act(async () => {
    await flush();
  });
};

// Phase 3.1 put a permission step in front of the Record button — grant
// access, which is what unlocks device names. Phase 3.2 removed the second
// step: proving the chosen microphone can actually be heard now happens
// automatically inside the Record press itself (see `pressRecord` below),
// not as a separate click a student — or a test — has to make first.
const completeSetup = async () => {
  await clickAndFlush(/set up microphone/i);
};

// Presses Record. Sprint 11 Phase 3.3 removed the blocking signal check from
// this path entirely — recording starts on the same click, with nothing in
// front of it. A test that wants the OPTIONAL, secondary "Test microphone"
// check drives that button and `vi.advanceTimersByTime` directly instead of
// reaching for this.
const pressRecord = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /^record$/i }));
    await flush();
  });
};

beforeEach(() => {
  currentIndex = 0;
  (submitShadowingAttempt as ReturnType<typeof vi.fn>).mockReset();
  (requestShadowingFeedback as ReturnType<typeof vi.fn>).mockReset();
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
    await pressRecord();

    // Two opens: the permission probe that unlocks device names, then the
    // recording itself. Phase 3.3 removed the blocking signal check that used
    // to sit between them — there is no third stream opened and closed before
    // Record is allowed to actually record.
    expect(mocks.getUserMedia).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^record$/i })).not.toBeInTheDocument();
    expect(screen.getAllByText('Recording').length).toBeGreaterThan(0);
  });

  // Conservative until Phase 0's bleed measurement exists: pausing is safe
  // whichever way that measurement lands.
  it('silences the player before opening the microphone', async () => {
    renderPanel();

    await completeSetup();
    await pressRecord();

    expect(pauseMedia).toHaveBeenCalledTimes(1);
  });

  it('offers playback of the recording after Stop', async () => {
    renderPanel();
    await completeSetup();
    await pressRecord();

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
    await pressRecord();
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
    await pressRecord();
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
    await pressRecord();

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
    await pressRecord();
    // Silence only AFTER the preflight has passed AND recording has begun,
    // so this is the recorder's own live warning rather than the preflight's
    // verdict leaking through (pressRecord's own check ran against a normal
    // signal, same as every other test's default fixture).
    FakeAudioContext.sampleAmplitude = 0;
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
    await pressRecord();
    await act(async () => {
      vi.advanceTimersByTime(2_000);
      await flush();
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('never constructs a recogniser, so it cannot take the microphone', async () => {
    renderPanel();

    await completeSetup();
    await pressRecord();

    expect(FakeSpeechRecognition.instances).toHaveLength(0);
  });

  // The absence is the guarantee. If any of these ever appears, grading has
  // moved to the client — which is the one thing Phase 3 must not do. Kept
  // through the transcript's removal precisely because it is not about the
  // transcript: it is about what this panel is forbidden to compute.
  it('renders no accuracy, no score and no pass verdict', async () => {
    renderPanel();
    await completeSetup();
    await pressRecord();
    await clickAndFlush(/stop/i);

    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/accuracy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bscore\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bpassed\b/i)).not.toBeInTheDocument();
  });

  // Phase 3.2 corrected this sentence again — see the dedicated test in
  // "submitting for scoring" for the current wording. What stays true across
  // every rewrite is that neither retired claim is still on screen.
  it('does not repeat either retired privacy claim', () => {
    renderPanel();

    expect(
      screen.queryByText(/not uploaded, scored or saved to your account/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/stays in this browser until you choose to send it/i),
    ).not.toBeInTheDocument();
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
    await pressRecord();

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
    await pressRecord();

    view.unmount();

    expect(mocks.track.stop).toHaveBeenCalled();
    expect(FakeMediaRecorder.latest().state).toBe('inactive');
  });

  it('revokes the recording URL when the student navigates away', async () => {
    const view = renderPanel();
    await completeSetup();
    await pressRecord();
    await clickAndFlush(/stop/i);

    view.unmount();

    expect(mocks.revokeObjectURL).toHaveBeenCalled();
  });

  // A recording of sentence 2 played back on sentence 4, with nothing on screen
  // saying which was which, is worse than no recording.
  it('discards the recording when the student moves to another sentence', async () => {
    const view = renderPanel();
    await completeSetup();
    await pressRecord();
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
  // `enumerateDevices` IS called on mount now (the silent Phase 3.2 probe) —
  // it cannot raise a prompt or open a stream, so that guarantee is unchanged.
  // The one that must never be called before a click is `getUserMedia`.
  it('asks for no permission until the student asks for it', async () => {
    renderPanel();

    // The button itself only appears once the silent mount probe (Phase 3.2)
    // has settled — permission is not granted in this fixture, so it settles
    // to a no-op almost immediately, but that still takes a tick.
    await act(async () => {
      await flush();
    });

    expect(mocks.getUserMedia).not.toHaveBeenCalled();
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

  // Sprint 11 Phase 3.3 — the compact mic row dropped the separate "Using: X"
  // line; the picker itself now shows the selected device, which is why a
  // wrong one is still visible without a second line of text to maintain.
  it('names the microphone in use, so a wrong one is visible', async () => {
    renderPanel();

    await clickAndFlush(/set up microphone/i);

    const select = screen.getByLabelText('Microphone') as HTMLSelectElement;
    expect(select.value).toBe('default');
    expect(select.options[select.selectedIndex].textContent).toContain(
      'Voice Changer Virtual Audio Device (WDM)',
    );
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
    await pressRecord();

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

// ---------------------------------------------------------------------------
// Sprint 11 Phase 3.3 — mic safety moved OFF the blocking Record path.
//
// Real-browser QA on Phase 3.2's design found Record waiting out a fixed
// 2.5s "Đang nghe…" check on every press — unacceptable. The signal check is
// no longer a precondition of anything: Record starts capture on the same
// click, every time. What used to be automatic and blocking is now a small,
// OPTIONAL, clearly secondary "Test microphone" action the student may use
// before pressing Record, and the primary safety net for a genuinely silent
// device becomes the live in-recording warning plus the existing hard
// rejection of a fully-silent take at Stop (`finalize()`'s SILENT_CAPTURE
// guard, unchanged, covered above in "warns during the recording…").
// ---------------------------------------------------------------------------

describe('ShadowingModePanel — Record never waits on a signal check', () => {
  it('is reachable as soon as a microphone is resolved, before anything has been measured', async () => {
    renderPanel();
    await clickAndFlush(/set up microphone/i);

    expect(screen.getByRole('button', { name: /^record$/i })).toBeEnabled();
    expect(screen.queryByTestId('microphone-preflight')).not.toBeInTheDocument();
  });

  it('starts recording immediately on Record, with no listening/checking step in front of it', async () => {
    renderPanel();
    await completeSetup();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^record$/i }));
      await flush();
    });

    expect(screen.queryByText(/listening… say something/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
  });

  // The virtual/silent device is no longer caught BEFORE recording — it is
  // caught DURING it (the live warning, asserted in the transcript describe
  // block above) and REJECTED at Stop by the recorder's own, preflight-
  // independent silence guard, exactly as it always has been for any take
  // that stayed silent throughout.
  it('records on a device that would have failed a signal check, then rejects the fully silent take at Stop', async () => {
    FakeAudioContext.sampleAmplitude = 0;
    renderPanel();
    await completeSetup();

    await pressRecord();
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(SILENCE_VERDICT_AFTER_MS + 200);
      await flush();
    });
    await clickAndFlush(/stop/i);

    expect(screen.getByText(/microphone recorded silence/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /stop/i })).not.toBeInTheDocument();
    expect(submitShadowingAttempt).not.toHaveBeenCalled();
  });

  // Gating on a check that physically cannot run would lock these students out
  // of the feature over a verdict nobody ever reached — moot now that nothing
  // gates on it at all, but still worth pinning that recording works cleanly
  // with no level meter available.
  it('records normally on a browser that cannot measure signal at all', async () => {
    restoreRecordingMocks();
    mocks = installRecordingMocks({ withoutAudioContext: true });
    renderPanel();
    await completeSetup();

    await pressRecord();

    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
    expect(screen.getByTestId('recorder-status')).toHaveTextContent('Recording');
  });
});

describe('ShadowingModePanel — the optional "Test microphone" action', () => {
  it('is a quiet, secondary control that never disables Record', async () => {
    renderPanel();
    await completeSetup();

    expect(screen.queryByTestId('microphone-preflight')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /test microphone/i }));
      await flush();
    });

    expect(screen.getByText(/listening… say something/i)).toBeInTheDocument();
    // Advisory, not a gate — Record stays enabled while the check runs.
    expect(screen.getByRole('button', { name: /^record$/i })).toBeEnabled();

    await act(async () => {
      vi.advanceTimersByTime(PREFLIGHT_DURATION_MS + 100);
      await flush();
    });

    expect(screen.getByText(/microphone is working/i)).toBeInTheDocument();
  });

  it('tells the student to try another input when the optional check finds one silent', async () => {
    FakeAudioContext.sampleAmplitude = 0;
    renderPanel();
    await completeSetup();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /test microphone/i }));
      await flush();
      vi.advanceTimersByTime(PREFLIGHT_DURATION_MS + 100);
      await flush();
    });

    expect(screen.getByText(/voice changer.*often produces no sound/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /test again/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /choose another microphone/i }),
    ).toBeInTheDocument();
    // Still advisory even on a failing verdict — nothing here blocks Record.
    expect(screen.getByRole('button', { name: /^record$/i })).toBeEnabled();
  });

  // A verdict belongs to the device it was measured on. Switching must
  // invalidate a previous manual check, same as before.
  it('clears a previous manual check result when the device is switched', async () => {
    renderPanel();
    await completeSetup();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /test microphone/i }));
      await flush();
      vi.advanceTimersByTime(PREFLIGHT_DURATION_MS + 100);
      await flush();
    });
    expect(screen.getByText(/microphone is working/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Microphone'), {
      target: { value: 'realtek-1' },
    });

    expect(screen.queryByTestId('microphone-preflight')).not.toBeInTheDocument();
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
    await pressRecord();
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
    await pressRecord();

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

// ---------------------------------------------------------------------------
// Sprint 11 Phase 4B — submitting a spoken attempt.
//
// The browser recogniser is gone for good (Phase 3.1): it cannot be pinned to
// the microphone the student chose and the preflight verified, so a transcript
// from it is a transcript from an unknown input. Scoring now happens on the
// server, over an uploaded blob that is transcribed and discarded.
//
// EVERY NUMBER RENDERED HERE CAME FROM THE SERVER. These tests assert that the
// panel displays a verdict rather than computing one — the fixture below is
// deliberately INTERNALLY INCONSISTENT (a "passed" verdict at 40%) so that a
// component quietly re-deriving pass/fail from the accuracy would fail.
// ---------------------------------------------------------------------------

const VERDICT: SubmitShadowingAttemptResult = {
  transcript: 'The otter wraps her baby',
  normalizedTranscript: 'the otter wraps her baby',
  alignment: [
    { op: 'MATCH', reference: 'the', spoken: 'the', referenceIndex: 0 },
    { op: 'SUBSTITUTE', reference: 'otter', spoken: 'water', referenceIndex: 1 },
    { op: 'DELETE', reference: 'wraps', spoken: null, referenceIndex: 2 },
    { op: 'INSERT', reference: null, spoken: 'um', referenceIndex: null },
  ],
  accuracyPercent: 40,
  wordsCorrect: 1,
  wordsTotal: 4,
  substitutions: 1,
  insertions: 1,
  deletions: 1,
  // Deliberately at odds with the accuracy above. A panel that recomputes this
  // would show "Not quite yet" and fail the test that reads it.
  passed: true,
  passThresholdPercent: 70,
  segment: {
    segmentId: 'seg-1',
    completedAt: '2026-08-06T00:00:00.000Z',
    bestAccuracyPercent: 40,
    attemptCount: 1,
  },
};

const recordAndStop = async () => {
  await completeSetup();
  await pressRecord();
  await clickAndFlush(/stop/i);
  // Submission is automatic now (Phase 3.2) — this is what lets every caller
  // assume a result (or a failure) already exists the moment this returns.
  await act(async () => {
    await flush();
  });
};

describe('ShadowingModePanel — submitting for scoring', () => {
  // Phase 3.2 — Submit stopped being a click a student could stop short of.
  // Stopping the recording is the whole decision now.
  it('uploads automatically once the student stops recording, with no button to press', async () => {
    (submitShadowingAttempt as ReturnType<typeof vi.fn>).mockResolvedValue(VERDICT);
    renderPanel();

    await recordAndStop();

    expect(submitShadowingAttempt).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('button', { name: /check my speaking/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('shadowing-result')).toBeInTheDocument();
  });

  // Said up front, before there is anything to decide — Phase 3.2 corrected
  // this copy for the same reason it corrected shadowingLocalOnlyNote: a
  // sentence promising a choice that no longer exists is worse than none.
  it('says the recording is sent as soon as it stops, and what happens to it after', () => {
    renderPanel();

    expect(
      screen.getByText(/sent for scoring as soon as you stop/i),
    ).toBeInTheDocument();
  });

  it('uploads the recorded blob and the duration', async () => {
    (submitShadowingAttempt as ReturnType<typeof vi.fn>).mockResolvedValue(VERDICT);
    renderPanel();
    await recordAndStop();

    expect(submitShadowingAttempt).toHaveBeenCalledTimes(1);
    const [segmentId, body] = (submitShadowingAttempt as ReturnType<typeof vi.fn>)
      .mock.calls[0];
    expect(segmentId).toBe('seg-1');
    expect(body.audio).toBeInstanceOf(Blob);
    expect(typeof body.clientAttemptId).toBe('string');
    // No transcript and no score: the client cannot claim what it said.
    expect(Object.keys(body).sort()).toEqual([
      'audio',
      'clientAttemptId',
      'durationMs',
    ]);
  });

  it('renders the server verdict rather than deriving one', async () => {
    (submitShadowingAttempt as ReturnType<typeof vi.fn>).mockResolvedValue(VERDICT);
    renderPanel();
    await recordAndStop();


    // 40% with `passed: true` — only a panel that reads the flag says "Passed".
    expect(screen.getByTestId('shadowing-result')).toBeInTheDocument();
    expect(screen.getByText('Passed')).toBeInTheDocument();
    // Exactly once, in the header pill. Phase 4C stopped repeating it beside
    // the verdict: one number in two places is one number that can be read as
    // two, and `getByText` failing on a duplicate is what pins that.
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText(/1\/4/)).toBeInTheDocument();
  });

  it('states the pass mark, so the score can be interpreted', async () => {
    (submitShadowingAttempt as ReturnType<typeof vi.fn>).mockResolvedValue(VERDICT);
    renderPanel();
    await recordAndStop();


    expect(screen.getByText(/Pass mark: 70%/)).toBeInTheDocument();
  });

  // The accuracy is a WORD-MATCH figure from a transcript. Presenting it as a
  // pronunciation score would be a fabricated assessment.
  it('says plainly that this is not a pronunciation score', async () => {
    (submitShadowingAttempt as ReturnType<typeof vi.fn>).mockResolvedValue(VERDICT);
    renderPanel();
    await recordAndStop();


    expect(
      screen.getByText(/not a pronunciation score/i),
    ).toBeInTheDocument();
  });

  it('shows the raw transcript, not the normalised one', async () => {
    (submitShadowingAttempt as ReturnType<typeof vi.fn>).mockResolvedValue(VERDICT);
    renderPanel();
    await recordAndStop();


    // Showing "the otter wraps her baby" would present our own processing as
    // the student's speech.
    expect(screen.getByText('The otter wraps her baby')).toBeInTheDocument();
  });
});

describe('ShadowingModePanel — the word-by-word comparison', () => {
  beforeEach(() => {
    (submitShadowingAttempt as ReturnType<typeof vi.fn>).mockResolvedValue(VERDICT);
  });

  it('renders one token per alignment entry, from the server', async () => {
    renderPanel();
    await recordAndStop();


    const comparison = screen.getByTestId('transcript-comparison');
    expect(comparison.children).toHaveLength(VERDICT.alignment.length);
  });

  // COLOUR IS NEVER THE ONLY CARRIER. This is the surface where "which word
  // did I get wrong?" is the entire question, and a red-and-green diff gives a
  // student with deuteranopia nothing at all.
  it('labels every token in words, not only in colour', async () => {
    renderPanel();
    await recordAndStop();


    screen.getByTestId('transcript-comparison');
    expect(screen.getByLabelText('the: Correct')).toBeInTheDocument();
    expect(screen.getByLabelText('otter: Wrong word')).toBeInTheDocument();
    expect(screen.getByLabelText('wraps: Missing')).toBeInTheDocument();
    expect(screen.getByLabelText('um: Extra')).toBeInTheDocument();
  });

  it('shows what was said instead, for a wrong word', async () => {
    renderPanel();
    await recordAndStop();


    expect(screen.getByText('(water)')).toBeInTheDocument();
  });
});

describe('ShadowingModePanel — submission failures each say their own thing', () => {
  const failWith = (error: Error) => {
    (submitShadowingAttempt as ReturnType<typeof vi.fn>).mockRejectedValue(error);
  };

  it('tells the student to wait when the speech service is down', async () => {
    failWith(new ApiError('down', 503));
    renderPanel();
    await recordAndStop();


    expect(
      screen.getByText(/speech recognition is unavailable right now/i),
    ).toBeInTheDocument();
  });

  it('tells the student to record again when the audio was unusable', async () => {
    failWith(new ApiError('bad audio', 400));
    renderPanel();
    await recordAndStop();


    expect(
      screen.getByText(/could not be processed. Please record again/i),
    ).toBeInTheDocument();
  });

  it('tells the student to slow down when rate limited', async () => {
    failWith(new ApiError('slow down', 429));
    renderPanel();
    await recordAndStop();


    expect(screen.getByText(/submitted a lot of attempts/i)).toBeInTheDocument();
  });

  it('names an expired session as an expired session', async () => {
    failWith(new AuthExpiredError('expired'));
    renderPanel();
    await recordAndStop();


    expect(screen.getByText(/session expired/i)).toBeInTheDocument();
  });

  // Losing a good take to a network blip would be the app's fault charged to
  // the student. The recording is still in hand, so the recovery is one button.
  it('keeps the recording and offers a retry rather than making them speak again', async () => {
    failWith(new ApiError('offline', 0));
    renderPanel();
    await recordAndStop();

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByTestId('recording-playback-audio')).toBeInTheDocument();
  });

  // Auto-submit fires once per take, not once per render. A network blip
  // must not turn into a loop that silently repeats a paid call — the only
  // way to try again is the student's own "Try again" press.
  it('does not automatically retry a failed submission', async () => {
    failWith(new ApiError('offline', 0));
    renderPanel();
    await recordAndStop();
    expect(submitShadowingAttempt).toHaveBeenCalledTimes(1);

    // Time and renders keep passing with nothing further asked of the
    // student — if the effect were mis-guarded this is where it would loop.
    await act(async () => {
      vi.advanceTimersByTime(5_000);
      await flush();
    });

    expect(submitShadowingAttempt).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  // A retry after a timeout must carry the SAME key, or the server pays for a
  // second transcription and may return a verdict that disagrees with the one
  // it already recorded.
  it('retries under the same idempotency key', async () => {
    failWith(new ApiError('offline', 0));
    renderPanel();
    await recordAndStop();

    (submitShadowingAttempt as ReturnType<typeof vi.fn>).mockResolvedValue(VERDICT);
    await clickAndFlush(/try again/i);

    const calls = (submitShadowingAttempt as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[1][1].clientAttemptId).toBe(calls[0][1].clientAttemptId);
  });

  // A NEW recording is a new attempt. Reusing the key would replay the old
  // verdict and score the student on audio they discarded.
  it('uses a fresh key for a fresh recording', async () => {
    (submitShadowingAttempt as ReturnType<typeof vi.fn>).mockResolvedValue(VERDICT);
    renderPanel();
    await recordAndStop();
    screen.getByTestId('shadowing-result');

    await clickAndFlush(/record again/i);
    await pressRecord();
    await clickAndFlush(/stop/i);
    await act(async () => {
      await flush();
    });

    const calls = (submitShadowingAttempt as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[1][1].clientAttemptId).not.toBe(calls[0][1].clientAttemptId);
  });

  it('clears the previous verdict when a new recording starts', async () => {
    (submitShadowingAttempt as ReturnType<typeof vi.fn>).mockResolvedValue(VERDICT);
    renderPanel();
    await recordAndStop();
    expect(screen.getByTestId('shadowing-result')).toBeInTheDocument();

    await clickAndFlush(/record again/i);

    // A verdict left on screen would belong to audio that no longer exists.
    expect(screen.queryByTestId('shadowing-result')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Sprint 11 Phase 4C — the redesigned workspace.
//
// The layout changed; what the panel is ALLOWED TO SAY did not. The tests that
// matter here are the ones about absence: no accuracy before the server has
// produced one, no second copy of a number, no control that promises something
// there is no endpoint for.
// ---------------------------------------------------------------------------

describe('ShadowingModePanel — the status strip', () => {
  it('numbers the sentence and counts its words', () => {
    renderPanel();

    expect(screen.getByText('#1')).toBeInTheDocument();
    // "The otter wraps her baby in kelp." — seven words, counted from the text
    // on screen. A count of what is rendered is not a score.
    expect(screen.getByText('7 words')).toBeInTheDocument();
  });

  // THE ABSENCE IS THE POINT. A 0% next to a sentence nobody has attempted
  // reads as a verdict, and this panel may not produce one.
  it('shows no accuracy at all until the server has judged an attempt', async () => {
    renderPanel();
    await recordAndStop();

    expect(screen.queryByText(/accuracy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('shows the accuracy once, from the verdict', async () => {
    (submitShadowingAttempt as ReturnType<typeof vi.fn>).mockResolvedValue(VERDICT);
    renderPanel();
    await recordAndStop();


    expect(screen.getByText('Accuracy')).toBeInTheDocument();
    expect(screen.getAllByText('40%')).toHaveLength(1);
  });

  it('saves a sentence for the session only, and says so', () => {
    renderPanel();

    const save = screen.getByRole('button', { name: /save sentence/i });
    expect(save).toHaveAttribute(
      'title',
      expect.stringMatching(/this session only/i),
    );

    fireEvent.click(save);

    expect(
      screen.getByRole('button', { name: /saved for this session/i }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  // There is no report endpoint in either mode. A live-looking button that
  // drops the report on the floor is worse than a grey one.
  it('offers Report as an admitted not-yet rather than a dead click', () => {
    renderPanel();

    expect(screen.getByRole('button', { name: /report issue/i })).toBeDisabled();
  });
});

describe('ShadowingModePanel — showing and hiding the sentence', () => {
  // Sprint 11 Phase 3.4 — the translation now defaults to visible too, along
  // with the sentence and its IPA.
  it('shows the sentence, its IPA, and its translation by default', () => {
    renderPanel();

    expect(screen.getByText(SEGMENTS[0].text)).toBeInTheDocument();
    expect(screen.getByText('/ˈɒtə/')).toBeInTheDocument();
    expect(screen.getByText(SEGMENTS[0].translationVi)).toBeInTheDocument();
  });

  it('hides the sentence on request and brings it back', () => {
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Sentence' }));
    expect(screen.queryByText(SEGMENTS[0].text)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sentence' }));
    expect(screen.getByText(SEGMENTS[0].text)).toBeInTheDocument();
  });

  it('hides the translation on request and brings it back', () => {
    renderPanel();
    expect(screen.getByText(SEGMENTS[0].translationVi)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Meaning' }));
    expect(screen.queryByText(SEGMENTS[0].translationVi)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Meaning' }));
    expect(screen.getByText(SEGMENTS[0].translationVi)).toBeInTheDocument();
  });

  // A toggle that reveals nothing reads as broken rather than as empty.
  it('offers no IPA toggle for a sentence that has no IPA', () => {
    currentIndex = 1;
    renderPanel();

    expect(screen.getByText(SEGMENTS[1].text)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'IPA' })).not.toBeInTheDocument();
  });
});

describe('ShadowingModePanel — the recording and its transcript stay together', () => {
  it('moves the player under "You said" once a verdict exists, without duplicating it', async () => {
    (submitShadowingAttempt as ReturnType<typeof vi.fn>).mockResolvedValue(VERDICT);
    renderPanel();
    await recordAndStop();


    const players = screen.getAllByTestId('recording-playback-audio');
    expect(players).toHaveLength(1);
    expect(screen.getByTestId('shadowing-result')).toContainElement(players[0]);
    expect(screen.getByText('You said:')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Sprint 11 Phase 4C — AI pronunciation coaching.
//
// It is an OPTIONAL SECOND ACTION on an attempt that has already been graded,
// and the tests below are mostly about what it must not do: appear before there
// is anything to coach on, put a number on screen, or make a failure look like
// the student's result is in doubt.
// ---------------------------------------------------------------------------

const FEEDBACK = {
  feedback: 'Bạn nói rõ ràng. Chú ý âm cuối /p/ trong "kelp".',
  generatedAt: '2026-08-06T00:00:00.000Z',
  model: 'gemini-2.5-flash',
  cached: false,
};

describe('ShadowingModePanel — AI pronunciation feedback', () => {
  beforeEach(() => {
    (submitShadowingAttempt as ReturnType<typeof vi.fn>).mockResolvedValue(VERDICT);
  });

  // Phase 3.2 — there is no longer a UI state where a recording has stopped
  // but not yet been submitted (that gap closed with auto-submit), so the
  // only window left where "stopped but not graded" is true is while the
  // automatic submission is itself still in flight. This pins that window
  // with a controllable promise rather than the describe block's default
  // instantly-resolving mock.
  it('offers no coaching while the automatic submission is still in flight', async () => {
    let resolveSubmit!: (value: SubmitShadowingAttemptResult) => void;
    (submitShadowingAttempt as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise<SubmitShadowingAttemptResult>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    renderPanel();
    await completeSetup();
    await pressRecord();
    await clickAndFlush(/stop/i);

    expect(
      screen.queryByRole('button', { name: /ask ai about my pronunciation/i }),
    ).not.toBeInTheDocument();

    await act(async () => {
      resolveSubmit(VERDICT);
      await flush();
    });

    expect(
      screen.getByRole('button', { name: /ask ai about my pronunciation/i }),
    ).toBeInTheDocument();
  });

  it('asks nothing of the server until the student presses the button', async () => {
    renderPanel();
    await recordAndStop();


    expect(requestShadowingFeedback).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: /ask ai about my pronunciation/i }),
    ).toBeInTheDocument();
  });

  // Said at the moment of the decision, not after the upload has happened.
  it('warns that the recording is sent again, next to the button that sends it', async () => {
    renderPanel();
    await recordAndStop();


    expect(screen.getByText(/sent again for this and deleted immediately/i))
      .toBeInTheDocument();
  });

  // THE SAME KEY AS THE ATTEMPT. That is what lets the server find the sentence
  // and the transcript in its own row, and what makes a second press free.
  it('sends the recording under the attempt s own idempotency key', async () => {
    (requestShadowingFeedback as ReturnType<typeof vi.fn>).mockResolvedValue(FEEDBACK);
    renderPanel();
    await recordAndStop();

    await clickAndFlush(/ask ai about my pronunciation/i);

    const submitCall = (submitShadowingAttempt as ReturnType<typeof vi.fn>).mock.calls[0];
    const feedbackCall = (requestShadowingFeedback as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(feedbackCall[0]).toBe('seg-1');
    expect(feedbackCall[1].clientAttemptId).toBe(submitCall[1].clientAttemptId);
    expect(feedbackCall[1].audio).toBeInstanceOf(Blob);
    // No transcript, no sentence, no score: the client cannot put words in the
    // coach's mouth.
    expect(Object.keys(feedbackCall[1]).sort()).toEqual(['audio', 'clientAttemptId']);
  });

  it('renders the advice with what produced it stated underneath', async () => {
    (requestShadowingFeedback as ReturnType<typeof vi.fn>).mockResolvedValue(FEEDBACK);
    renderPanel();
    await recordAndStop();

    await clickAndFlush(/ask ai about my pronunciation/i);

    expect(screen.getByTestId('ai-pronunciation-feedback')).toHaveTextContent(
      'Chú ý âm cuối',
    );
    expect(screen.getByText(/they are advice, not a score/i)).toBeInTheDocument();
  });

  // >>> THE ONE THAT MATTERS. <<< The attempt has exactly one number and it came
  // from the server's alignment. Coaching must not add a second.
  it('puts no second number on the screen', async () => {
    (requestShadowingFeedback as ReturnType<typeof vi.fn>).mockResolvedValue(FEEDBACK);
    renderPanel();
    await recordAndStop();

    await clickAndFlush(/ask ai about my pronunciation/i);

    expect(screen.getAllByText('40%')).toHaveLength(1);
    expect(screen.getByTestId('ai-pronunciation-feedback').textContent).not.toMatch(
      /\d+\s*%/,
    );
  });

  // A feedback failure changes nothing about a result already earned, and the
  // copy has to say so rather than leaving the student wondering.
  it('says the result is unaffected when the coach is unavailable', async () => {
    (requestShadowingFeedback as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ApiError('down', 503),
    );
    renderPanel();
    await recordAndStop();

    await clickAndFlush(/ask ai about my pronunciation/i);

    expect(screen.getByRole('alert')).toHaveTextContent(
      /your result above is unaffected/i,
    );
    expect(screen.getByTestId('shadowing-result')).toBeInTheDocument();
    expect(screen.getByText('Passed')).toBeInTheDocument();
  });

  it('names an expired session as an expired session here too', async () => {
    (requestShadowingFeedback as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AuthExpiredError('expired'),
    );
    renderPanel();
    await recordAndStop();

    await clickAndFlush(/ask ai about my pronunciation/i);

    expect(screen.getByRole('alert')).toHaveTextContent(/session expired/i);
  });

  // Coaching belongs to the take it was written about. Leaving it on screen
  // after a new recording would attribute advice to audio that no longer exists.
  it('drops the advice when the student records again', async () => {
    (requestShadowingFeedback as ReturnType<typeof vi.fn>).mockResolvedValue(FEEDBACK);
    renderPanel();
    await recordAndStop();
    await clickAndFlush(/ask ai about my pronunciation/i);
    expect(screen.getByTestId('ai-pronunciation-feedback')).toBeInTheDocument();

    await clickAndFlush(/record again/i);

    expect(
      screen.queryByTestId('ai-pronunciation-feedback'),
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Sprint 11 Phase 3.4 — Next, and completion that is earned, not positional.
//
// Reaching the last segment must never, by itself, read as "done" — only
// every segment having actually PASSED does. The fixture below deliberately
// fails segment 1's first attempt, so segment 2 completing first (while
// segment 1 is still outstanding) is the exact "reached the end but earlier
// work is undone" case Next must not treat as complete.
// ---------------------------------------------------------------------------

describe('ShadowingModePanel — Next and session completion', () => {
  const FAILING_VERDICT: SubmitShadowingAttemptResult = {
    ...VERDICT,
    accuracyPercent: 20,
    wordsCorrect: 1,
    wordsTotal: 4,
    passed: false,
  };

  // The microphone is set up ONCE per render — a second `completeSetup()`
  // call on the same panel instance finds no "Set up microphone" button,
  // because access is already READY. Every recording after the first one in
  // these tests (a Next click, a manual retake) uses this instead.
  const recordAgainAndStop = async () => {
    await pressRecord();
    await clickAndFlush(/stop/i);
    await act(async () => {
      await flush();
    });
  };

  it('offers a Next button that is not the old listen-and-repeat card', () => {
    renderPanel();

    expect(
      screen.getByRole('button', { name: /^next/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/listen and repeat/i)).not.toBeInTheDocument();
  });

  it('does not treat reaching the last segment as completion when an earlier one never passed', async () => {
    const mockedSubmit = submitShadowingAttempt as ReturnType<typeof vi.fn>;
    // seg-1 fails, seg-2 passes — segment 2 finishing does not clear segment 1.
    mockedSubmit.mockResolvedValueOnce(FAILING_VERDICT);
    mockedSubmit.mockResolvedValueOnce(VERDICT);

    renderPanel();
    await recordAndStop(); // seg-1, fails

    await clickAndFlush(/^next/i);
    expect(screen.getByText(SEGMENTS[1].text)).toBeInTheDocument();

    await recordAgainAndStop(); // seg-2, passes — but seg-1 is still outstanding

    await clickAndFlush(/^next/i);

    // Reached the end of the list, seg-2 just passed — and Next must still
    // send the student BACK to seg-1 rather than declaring the lesson done.
    expect(screen.queryByText('Listening Complete')).not.toBeInTheDocument();
    expect(screen.getByText(SEGMENTS[0].text)).toBeInTheDocument();
  });

  it('shows the completion summary only once every segment has actually passed', async () => {
    const mockedSubmit = submitShadowingAttempt as ReturnType<typeof vi.fn>;
    mockedSubmit.mockResolvedValueOnce(FAILING_VERDICT);
    mockedSubmit.mockResolvedValueOnce(VERDICT);
    mockedSubmit.mockResolvedValueOnce(VERDICT);

    renderPanel();
    await recordAndStop(); // seg-1, fails
    await clickAndFlush(/^next/i);
    await recordAgainAndStop(); // seg-2, passes
    await clickAndFlush(/^next/i);
    expect(screen.getByText(SEGMENTS[0].text)).toBeInTheDocument();

    await recordAgainAndStop(); // seg-1, passes this time — everything is now done
    await clickAndFlush(/^next/i);

    expect(screen.getByText('Listening Complete')).toBeInTheDocument();
  });

  it('the completion summary reflects the BEST attempt per segment, not a sum of every retake', async () => {
    const mockedSubmit = submitShadowingAttempt as ReturnType<typeof vi.fn>;
    // seg-1 retaken three times: 1/4, then 4/4 PASS — must count as 4/4 once,
    // never 1+4=5/8.
    mockedSubmit.mockResolvedValueOnce(FAILING_VERDICT);
    mockedSubmit.mockResolvedValueOnce({ ...VERDICT, wordsCorrect: 4, wordsTotal: 4 });
    // seg-2 passes on the first try.
    mockedSubmit.mockResolvedValueOnce(VERDICT);

    renderPanel();
    await recordAndStop(); // seg-1, fails (1/4)
    await clickAndFlush(/record again/i);
    await recordAgainAndStop(); // seg-1, retaken, passes (4/4)

    await clickAndFlush(/^next/i);
    await recordAgainAndStop(); // seg-2, passes on the first try (VERDICT's own shape: 1/4)
    await clickAndFlush(/^next/i);

    const summary = screen.getByText('Listening Complete').closest(
      '.practice-fade-in',
    ) as HTMLElement;
    // Best of seg-1's two attempts (4/4) + seg-2 (1/4) = 5/8 — NOT the sum of
    // every attempt (1 + 4 + 1 = 6 / 4 + 4 + 4 = 12), which is what a naive
    // running accumulator would have produced instead.
    expect(within(summary).getByText('5/8')).toBeInTheDocument();
  });

  it('replaying the lesson from the summary re-arms completion from scratch', async () => {
    const mockedSubmit = submitShadowingAttempt as ReturnType<typeof vi.fn>;
    mockedSubmit.mockResolvedValue(VERDICT);

    renderPanel();
    await recordAndStop();
    await clickAndFlush(/^next/i);
    await recordAgainAndStop();
    await clickAndFlush(/^next/i);
    expect(screen.getByText('Listening Complete')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /replay lesson/i }));

    expect(screen.getByText(SEGMENTS[0].text)).toBeInTheDocument();
    expect(screen.queryByText('Listening Complete')).not.toBeInTheDocument();
  });
});
