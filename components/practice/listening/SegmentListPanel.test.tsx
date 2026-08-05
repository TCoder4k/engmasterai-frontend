import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import SegmentListPanel from './SegmentListPanel';
import type { ListeningSegment } from '../../../services/listeningService';

// Sprint 11 Phase 2 — successor to SubtitlesSidebar.test.tsx.
//
// THE CONTENT-LEAK ASSERTIONS ARE CARRIED OVER DELIBERATELY. Sprint 03F had to
// fix a masked row that revealed its own sentence as soon as it became the
// current one (`canReveal = isActive || isSolved`). In Dictation the sentence
// IS the answer, so those three tests are a security guarantee about content,
// not a styling preference, and they must survive every rewrite of this list.
//
// What legitimately changed: rows no longer have their own replay callback.
// One shared player now owns playback, so a row's job is to become the current
// sentence and the transport bar plays it. `onSelectSegment` is therefore the
// only click behaviour left to assert.
const SEGMENTS: ListeningSegment[] = [
  {
    id: 'seg-1',
    orderIndex: 0,
    text: 'first segment here',
    ipa: null,
    translationVi: 'phân đoạn một',
    startTimeMs: 0,
    endTimeMs: 3000,
  },
  {
    id: 'seg-2',
    orderIndex: 1,
    text: 'second one now',
    ipa: null,
    translationVi: 'phân đoạn hai',
    startTimeMs: 3000,
    endTimeMs: 6000,
  },
  {
    id: 'seg-3',
    orderIndex: 2,
    text: 'third and last',
    ipa: null,
    translationVi: 'phân đoạn ba',
    startTimeMs: 6000,
    endTimeMs: 9000,
  },
];

const renderPanel = (
  overrides: Partial<Parameters<typeof SegmentListPanel>[0]> = {},
) => {
  const props = {
    segments: SEGMENTS,
    currentIndex: 1,
    revealedSegmentIds: new Set<string>(['seg-1']),
    assistedSegmentIds: new Set<string>(),
    maskUnrevealed: true,
    hideTranslation: false,
    isPlaying: false,
    onSelectSegment: vi.fn(),
    ...overrides,
  };
  render(
    <LanguageProvider>
      <SegmentListPanel {...props} />
    </LanguageProvider>,
  );
  return props;
};

afterEach(() => cleanup());

describe('SegmentListPanel — content masking (Dictation)', () => {
  it('a completed sentence reveals its real text', () => {
    renderPanel();
    expect(screen.getByText('first segment here')).toBeInTheDocument();
  });

  it('the current, uncompleted sentence stays masked — it must not leak the answer', () => {
    renderPanel();
    expect(screen.queryByText('second one now')).not.toBeInTheDocument();
  });

  it('a later sentence remains masked', () => {
    renderPanel();
    expect(screen.queryByText('third and last')).not.toBeInTheDocument();
  });

  it('masking dots are hidden from assistive tech, so the answer is not read aloud either', () => {
    renderPanel();
    const row = screen.getByRole('button', { name: 'Question 2' });
    const masked = row.querySelector('[aria-hidden="true"].font-mono');
    expect(masked).not.toBeNull();
    // Dots only — no letter of the real sentence anywhere in the masked node.
    expect(masked?.textContent).toMatch(/^[•\s]+$/);
  });

  it('shows every sentence when masking is off — the Shadowing case', () => {
    renderPanel({ maskUnrevealed: false });
    expect(screen.getByText('second one now')).toBeInTheDocument();
    expect(screen.getByText('third and last')).toBeInTheDocument();
  });
});

describe('SegmentListPanel — badges and translation', () => {
  it('shows the LEARNING badge on the active, uncompleted, not-playing sentence', () => {
    renderPanel({ isPlaying: false });
    expect(screen.getByText('Learning')).toBeInTheDocument();
    expect(screen.queryByText('Listening')).not.toBeInTheDocument();
  });

  it('shows the LISTENING badge instead while the active sentence is playing', () => {
    renderPanel({ isPlaying: true });
    expect(screen.getByText('Listening')).toBeInTheDocument();
    expect(screen.queryByText('Learning')).not.toBeInTheDocument();
  });

  it('translation appears only for a revealed sentence and respects hideTranslation', () => {
    const { rerender } = render(
      <LanguageProvider>
        <SegmentListPanel
          segments={SEGMENTS}
          currentIndex={1}
          revealedSegmentIds={new Set(['seg-1'])}
          assistedSegmentIds={new Set()}
          maskUnrevealed
          hideTranslation={false}
          isPlaying={false}
          onSelectSegment={vi.fn()}
        />
      </LanguageProvider>,
    );
    expect(screen.getByText('phân đoạn một')).toBeInTheDocument();

    rerender(
      <LanguageProvider>
        <SegmentListPanel
          segments={SEGMENTS}
          currentIndex={1}
          revealedSegmentIds={new Set(['seg-1'])}
          assistedSegmentIds={new Set()}
          maskUnrevealed
          hideTranslation
          isPlaying={false}
          onSelectSegment={vi.fn()}
        />
      </LanguageProvider>,
    );
    expect(screen.queryByText('phân đoạn một')).not.toBeInTheDocument();
  });

  it('marks a sentence completed with help distinctly, in text and not by colour alone', () => {
    renderPanel({
      revealedSegmentIds: new Set(['seg-1']),
      assistedSegmentIds: new Set(['seg-1']),
    });
    expect(screen.getByText('Assisted')).toBeInTheDocument();
  });
});

describe('SegmentListPanel — progress and selection', () => {
  it('reports real completed counts, never a fabricated percentage', () => {
    renderPanel({ revealedSegmentIds: new Set(['seg-1', 'seg-3']) });
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '2');
    expect(bar).toHaveAttribute('aria-valuemax', '3');
    expect(screen.getByText('67%')).toBeInTheDocument();
  });

  it('clicking any row selects it — playback belongs to the shared transport', () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Question 3' }));
    expect(props.onSelectSegment).toHaveBeenCalledWith(2);
  });

  it('marks the current row with aria-current for screen readers', () => {
    renderPanel({ currentIndex: 2 });
    expect(screen.getByRole('button', { name: 'Question 3' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });
});
