import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import DictationWorkspace from './DictationWorkspace';
import type { ListeningSegment } from '../../../services/listeningService';

// Sprint 03F: translation gated on `solved` (not a hideTranslation prop,
// which this component no longer accepts at all), a single renamed Next
// action, compact Ctrl/Enter shortcut badges, and a bare-Ctrl replay
// keydown/keyup design that must never intercept Ctrl+R or any other
// Ctrl combo.
//
// Sprint 11 Phase 2 — the fixture is now a BACKEND segment shape (string uuid,
// `text`/`translationVi`, ms timings) rather than the deleted client seed's.
// Every behavioural assertion below is unchanged: the grading rules, the
// assisted-tracking rules and all seven Ctrl-shortcut guarantees survive the
// port, which is the point of asserting them here rather than in the page.
//
// Note what the fixture CANNOT carry: `normalizedText`. The server never sends
// it, and this component never needed it.
const SEGMENT: ListeningSegment = {
  id: 'a3f1c2d4-0000-4000-8000-000000000001',
  orderIndex: 0,
  text: 'hi there',
  ipa: null,
  translationVi: 'xin chào bạn',
  startTimeMs: 0,
  endTimeMs: 3000,
};

const renderWorkspace = (overrides: Partial<Parameters<typeof DictationWorkspace>[0]> = {}) => {
  const props = {
    segment: SEGMENT,
    segmentNumber: 1,
    totalSegments: 1,
    fontSize: 'large' as const,
    onFontSizeChange: vi.fn(),
    isSentenceSaved: false,
    onToggleSaveSentence: vi.fn(),
    onSegmentSolved: vi.fn(),
    onAdvance: vi.fn(),
    onPlayPause: vi.fn(),
    onReplay: vi.fn(),
    ...overrides,
  };
  render(
    <LanguageProvider>
      <DictationWorkspace {...props} />
    </LanguageProvider>,
  );
  return props;
};

const solveSegment = () => {
  fireEvent.change(screen.getByPlaceholderText('Type what you hear'), { target: { value: 'hi there' } });
};

afterEach(() => cleanup());

describe('DictationWorkspace — Next action + translation gating', () => {
  it('shows the renamed Next action and keeps it disabled until solved', () => {
    renderWorkspace();
    const nextButton = screen.getByRole('button', { name: 'Next >' });
    expect(nextButton).toBeDisabled();

    solveSegment();
    expect(screen.getByRole('button', { name: 'Next >' })).not.toBeDisabled();
  });

  it('hides the translation until the segment is solved', () => {
    renderWorkspace();
    expect(screen.queryByText('xin chào bạn')).not.toBeInTheDocument();

    solveSegment();
    expect(screen.getByText('xin chào bạn')).toBeInTheDocument();
  });

  it('shows only the two compact Ctrl/Enter shortcut badges, not the old combined hint', () => {
    renderWorkspace();
    expect(screen.getByText('Ctrl to replay')).toBeInTheDocument();
    expect(screen.getByText('Enter for next')).toBeInTheDocument();
    expect(screen.queryByText(/Space play\/pause/)).not.toBeInTheDocument();
  });
});

describe('DictationWorkspace — first-letter hint vs reveal (assisted tracking)', () => {
  it('first-letter hint does not mark the segment as assisted', () => {
    const props = renderWorkspace();
    fireEvent.keyDown(window, { key: 'h', altKey: true });
    // Complete the rest by typing correctly (not via reveal).
    fireEvent.change(screen.getByPlaceholderText('Type what you hear'), { target: { value: 'hi there' } });

    expect(props.onSegmentSolved).toHaveBeenCalledWith({ assisted: false, wordsCorrect: 2, wordsTotal: 2 });
  });

  it('Reveal Word marks the segment as assisted, and excludes revealed words from wordsCorrect', () => {
    const props = renderWorkspace();
    fireEvent.keyDown(window, { key: 'r', altKey: true });
    fireEvent.keyDown(window, { key: 'r', altKey: true });

    expect(props.onSegmentSolved).toHaveBeenCalledWith({ assisted: true, wordsCorrect: 0, wordsTotal: 2 });
  });
});

describe('DictationWorkspace — bare-Ctrl replay', () => {
  it('a standalone Ctrl press+release replays exactly once', () => {
    const props = renderWorkspace();
    fireEvent.keyDown(window, { key: 'Control' });
    fireEvent.keyUp(window, { key: 'Control' });

    expect(props.onReplay).toHaveBeenCalledTimes(1);
  });

  it('works while the answer textarea is focused', () => {
    const props = renderWorkspace();
    const textarea = screen.getByPlaceholderText('Type what you hear');
    textarea.focus();
    fireEvent.keyDown(textarea, { key: 'Control' });
    fireEvent.keyUp(textarea, { key: 'Control' });

    expect(props.onReplay).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+C does not trigger replay', () => {
    const props = renderWorkspace();
    fireEvent.keyDown(window, { key: 'Control' });
    fireEvent.keyDown(window, { key: 'c', ctrlKey: true });
    fireEvent.keyUp(window, { key: 'Control' });

    expect(props.onReplay).not.toHaveBeenCalled();
  });

  it('Ctrl+V does not trigger replay', () => {
    const props = renderWorkspace();
    fireEvent.keyDown(window, { key: 'Control' });
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true });
    fireEvent.keyUp(window, { key: 'Control' });

    expect(props.onReplay).not.toHaveBeenCalled();
  });

  it('Ctrl+R does not trigger replay and is never intercepted (no preventDefault)', () => {
    const props = renderWorkspace();
    fireEvent.keyDown(window, { key: 'Control' });
    const notPrevented = fireEvent.keyDown(window, { key: 'r', ctrlKey: true });
    fireEvent.keyUp(window, { key: 'Control' });

    expect(props.onReplay).not.toHaveBeenCalled();
    // fireEvent returns false only when preventDefault() was called.
    expect(notPrevented).toBe(true);
  });

  it('held Ctrl with repeated (auto-repeat) keydown events still replays only once on release', () => {
    const props = renderWorkspace();
    fireEvent.keyDown(window, { key: 'Control', repeat: false });
    fireEvent.keyDown(window, { key: 'Control', repeat: true });
    fireEvent.keyDown(window, { key: 'Control', repeat: true });
    fireEvent.keyUp(window, { key: 'Control' });

    expect(props.onReplay).toHaveBeenCalledTimes(1);
  });

  it('plain R still replays (kept alongside the new Ctrl shortcut)', () => {
    const props = renderWorkspace();
    fireEvent.keyDown(window, { key: 'r' });

    expect(props.onReplay).toHaveBeenCalledTimes(1);
  });
});
