import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import SpeakingRecorderControl from './SpeakingRecorderControl';
import * as feedbackSounds from '../../../services/feedbackSounds';
import {
  installRecordingMocks,
  restoreRecordingMocks,
  FakeAudioContext,
  RecordingMocks,
} from '../listening/recording/testDoubles';

// Speaking Partner — the tap-to-talk mic control, now driving
// useSpeakingLiveCapture (16kHz PCM16 streaming) instead of useRecorder
// (MediaRecorder). Drives the REAL hook through the same
// getUserMedia/AudioContext doubles Shadowing/MicrophonePreflight already
// use — extended with a fake ScriptProcessorNode/GainNode for this hook's
// own graph — rather than mocking the hook away.

const flush = async () => {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
};

let mocks: RecordingMocks;

beforeEach(() => {
  mocks = installRecordingMocks();
  vi.spyOn(feedbackSounds, 'playRecordStart').mockImplementation(() => {});
  vi.spyOn(feedbackSounds, 'playRecordStop').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  restoreRecordingMocks();
  vi.restoreAllMocks();
});

const renderControl = (props: Partial<React.ComponentProps<typeof SpeakingRecorderControl>> = {}) => {
  const onAudioChunk = vi.fn(props.onAudioChunk);
  const onRecordingStart = vi.fn(props.onRecordingStart);
  const onRecordingStop = vi.fn(props.onRecordingStop);
  render(
    <LanguageProvider>
      <SpeakingRecorderControl
        onAudioChunk={onAudioChunk}
        onRecordingStart={onRecordingStart}
        onRecordingStop={onRecordingStop}
        disabled={props.disabled}
        maxDurationMs={props.maxDurationMs}
        isAiSpeaking={props.isAiSpeaking}
      />
    </LanguageProvider>,
  );
  return {
    onAudioChunk: onAudioChunk as ReturnType<typeof vi.fn>,
    onRecordingStart: onRecordingStart as ReturnType<typeof vi.fn>,
    onRecordingStop: onRecordingStop as ReturnType<typeof vi.fn>,
  };
};

describe('SpeakingRecorderControl — tap to talk', () => {
  it('starts idle, showing "Tap to talk" and not recording', () => {
    renderControl();

    expect(screen.getByRole('button', { name: /tap to talk/i })).toBeInTheDocument();
  });

  it('a tap starts recording: calls onRecordingStart, switches the label, and opens a 16kHz capture graph', async () => {
    const { onRecordingStart } = renderControl();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /tap to talk/i }));
      await flush();
    });

    expect(screen.getByRole('button', { name: /tap to stop/i })).toBeInTheDocument();
    expect(onRecordingStart).toHaveBeenCalledTimes(1);
    expect(feedbackSounds.playRecordStart).toHaveBeenCalled();
    expect(FakeAudioContext.latest().requestedSampleRate).toBe(16000);
  });

  it('streams a base64-encoded PCM16 chunk to onAudioChunk as audio frames arrive', async () => {
    const { onAudioChunk } = renderControl();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /tap to talk/i }));
      await flush();
    });

    const processor = FakeAudioContext.latest().processorNode;
    expect(processor).not.toBeNull();
    act(() => {
      processor!.emitAudioProcess(new Float32Array([0, 0.5, -0.5, 1, -1]));
    });

    expect(onAudioChunk).toHaveBeenCalledTimes(1);
    expect(typeof onAudioChunk.mock.calls[0][0]).toBe('string');
    expect(onAudioChunk.mock.calls[0][0].length).toBeGreaterThan(0);
  });

  it('resamples audio to a true 16kHz stream even when the browser keeps its own native rate — the real bug that made speech reach Gemini Live garbled', async () => {
    // Simulates a browser that constructs the AudioContext at 48000Hz
    // regardless of the { sampleRate: 16000 } request (real Web Audio
    // behaviour some engines/devices exhibit). Without resampling, those
    // chunks would still be labelled "16kHz" to Gemini Live while actually
    // running 3x too fast — speech compressed into something unintelligible,
    // which Gemini's STT then filled in with a plausible-sounding
    // hallucination instead of erroring. This is the production bug a
    // student reported ("it doesn't understand anything I say").
    FakeAudioContext.forceSampleRate = 48000;
    const { onAudioChunk } = renderControl();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /tap to talk/i }));
      await flush();
    });

    const processor = FakeAudioContext.latest().processorNode;
    act(() => {
      processor!.emitAudioProcess(new Float32Array(300)); // 300 samples @ 48kHz
    });

    expect(onAudioChunk).toHaveBeenCalledTimes(1);
    const decodedByteLength = atob(onAudioChunk.mock.calls[0][0] as string).length;
    // 300 samples at 48kHz resampled to 16kHz is ~100 samples (ratio 3), at
    // 2 bytes/sample (Int16) = 200 bytes — NOT 600 bytes, which is what an
    // unresampled chunk mislabelled as 16kHz would have sent.
    expect(decodedByteLength).toBe(200);
  });

  it('a second tap stops recording, calls onRecordingStop, and returns to "Tap to talk"', async () => {
    const { onRecordingStop } = renderControl();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /tap to talk/i }));
      await flush();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /tap to stop/i }));
      await flush();
    });

    expect(onRecordingStop).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /tap to talk/i })).toBeInTheDocument();
    expect(feedbackSounds.playRecordStop).toHaveBeenCalled();
  });

  // The H1 race, in its Live-streaming form: a tap that lands while capture
  // is still REQUESTING_PERMISSION (before getUserMedia resolves) must not
  // be lost — it should be honoured the instant recording actually starts,
  // completing a full start-then-immediately-stop cycle rather than leaving
  // the graph open with nothing able to close it. Now guarded INSIDE
  // useSpeakingLiveCapture itself — see that hook's own header. Two
  // SEPARATE, synchronous act() calls, same reasoning as the original
  // useRecorder-based test: React 18 batches updates inside one act() with
  // no render flush between them, so a single act() wrapping both clicks
  // would never let the race actually occur.
  it('a tap landing during REQUESTING_PERMISSION is honoured once recording actually starts', async () => {
    const { onRecordingStart, onRecordingStop } = renderControl();
    const button = screen.getByRole('button', { name: /tap to talk/i });

    act(() => {
      fireEvent.click(button); // start() called — synchronously still REQUESTING_PERMISSION
    });
    act(() => {
      fireEvent.click(button); // lands before getUserMedia's promise has resolved
    });

    await act(async () => {
      await flush(); // let the async chain reach RECORDING — the deferred stop fires here
    });

    expect(onRecordingStart).toHaveBeenCalledTimes(1);
    expect(onRecordingStop).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /tap to talk/i })).toBeInTheDocument();
  });

  it('disabled blocks a tap from starting a new recording', async () => {
    const { onRecordingStart } = renderControl({ disabled: true });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /tap to talk/i }));
      await flush();
    });

    expect(screen.getByRole('button', { name: /tap to talk/i })).toBeInTheDocument();
    expect(onRecordingStart).not.toHaveBeenCalled();
  });

  it('recording still works correctly even if the sound effects throw', async () => {
    vi.spyOn(feedbackSounds, 'playRecordStart').mockImplementation(() => {
      throw new Error('AudioContext blocked');
    });
    vi.spyOn(feedbackSounds, 'playRecordStop').mockImplementation(() => {
      throw new Error('AudioContext blocked');
    });
    const { onRecordingStart, onRecordingStop } = renderControl();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /tap to talk/i }));
      await flush();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /tap to stop/i }));
      await flush();
    });

    expect(onRecordingStart).toHaveBeenCalledTimes(1);
    expect(onRecordingStop).toHaveBeenCalledTimes(1);
  });
});

void mocks;
