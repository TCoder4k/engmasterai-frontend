import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import SubtitlesSidebar from './SubtitlesSidebar';
import { DictationLesson } from './listeningContent';

// Sprint 03F: the current-but-unsolved segment must stay masked (it used to
// leak the real sentence via `canReveal = isActive || isSolved`), gets a
// LISTENING/LEARNING badge depending on real playback state, and clicking a
// solved row replays its audio instead of navigating to it.
const LESSON: DictationLesson = {
  id: 'lesson-1',
  title: 'Lesson',
  description: 'desc',
  topic: 'Business',
  level: 'B1',
  estimatedMinutes: 3,
  speaker: 'Speaker',
  segments: [
    { id: 1, textEn: 'first segment here', textVi: 'phân đoạn một', normalizedAnswer: 'first segment here', durationSeconds: 3 },
    { id: 2, textEn: 'second one now', textVi: 'phân đoạn hai', normalizedAnswer: 'second one now', durationSeconds: 3 },
    { id: 3, textEn: 'third and last', textVi: 'phân đoạn ba', normalizedAnswer: 'third and last', durationSeconds: 3 },
  ],
};

const renderSidebar = (overrides: Partial<Parameters<typeof SubtitlesSidebar>[0]> = {}) => {
  const props = {
    lesson: LESSON,
    currentSegmentIndex: 1,
    solvedSegmentIds: new Set<number>([1]),
    assistedSegmentIds: new Set<number>(),
    hideTranslation: false,
    isPlaying: false,
    replayingSegmentIndex: null,
    onSelectSegment: vi.fn(),
    onReplaySegment: vi.fn(),
    ...overrides,
  };
  render(
    <LanguageProvider>
      <SubtitlesSidebar {...props} />
    </LanguageProvider>,
  );
  return props;
};

afterEach(() => cleanup());

describe('SubtitlesSidebar segment states', () => {
  it('a completed segment reveals its real sentence', () => {
    renderSidebar({ currentSegmentIndex: 1, solvedSegmentIds: new Set([1]) });
    expect(screen.getByText('first segment here')).toBeInTheDocument();
  });

  it('the current, unsolved segment stays masked — does not leak its real sentence', () => {
    renderSidebar({ currentSegmentIndex: 1, solvedSegmentIds: new Set([1]) });
    expect(screen.queryByText('second one now')).not.toBeInTheDocument();
  });

  it('a future segment remains masked', () => {
    renderSidebar({ currentSegmentIndex: 1, solvedSegmentIds: new Set([1]) });
    expect(screen.queryByText('third and last')).not.toBeInTheDocument();
  });

  it('shows the LEARNING badge on the active, unsolved, not-playing segment', () => {
    renderSidebar({ currentSegmentIndex: 1, solvedSegmentIds: new Set([1]), isPlaying: false });
    expect(screen.getByText('Learning')).toBeInTheDocument();
    expect(screen.queryByText('Listening')).not.toBeInTheDocument();
  });

  it('shows the LISTENING badge instead while the active segment is playing', () => {
    renderSidebar({ currentSegmentIndex: 1, solvedSegmentIds: new Set([1]), isPlaying: true });
    expect(screen.getByText('Listening')).toBeInTheDocument();
    expect(screen.queryByText('Learning')).not.toBeInTheDocument();
  });

  it('shows the LISTENING badge on a solved row being replayed via replayingSegmentIndex', () => {
    renderSidebar({ currentSegmentIndex: 1, solvedSegmentIds: new Set([1]), replayingSegmentIndex: 0 });
    expect(screen.getByText('Listening')).toBeInTheDocument();
  });

  it('translation only appears for a completed segment, and respects the hideTranslation toggle', () => {
    const { rerender } = render(
      <LanguageProvider>
        <SubtitlesSidebar
          lesson={LESSON}
          currentSegmentIndex={1}
          solvedSegmentIds={new Set([1])}
          assistedSegmentIds={new Set()}
          hideTranslation={false}
          isPlaying={false}
          replayingSegmentIndex={null}
          onSelectSegment={vi.fn()}
          onReplaySegment={vi.fn()}
        />
      </LanguageProvider>,
    );
    expect(screen.getByText('phân đoạn một')).toBeInTheDocument();

    rerender(
      <LanguageProvider>
        <SubtitlesSidebar
          lesson={LESSON}
          currentSegmentIndex={1}
          solvedSegmentIds={new Set([1])}
          assistedSegmentIds={new Set()}
          hideTranslation
          isPlaying={false}
          replayingSegmentIndex={null}
          onSelectSegment={vi.fn()}
          onReplaySegment={vi.fn()}
        />
      </LanguageProvider>,
    );
    expect(screen.queryByText('phân đoạn một')).not.toBeInTheDocument();
  });
});

describe('SubtitlesSidebar click behavior', () => {
  it('clicking an unsolved (future) segment jumps to it', () => {
    const props = renderSidebar({ currentSegmentIndex: 1, solvedSegmentIds: new Set([1]) });
    fireEvent.click(screen.getByRole('button', { name: /#3/ }));

    expect(props.onSelectSegment).toHaveBeenCalledWith(2);
    expect(props.onReplaySegment).not.toHaveBeenCalled();
  });

  it('clicking a solved segment replays its audio instead of jumping', () => {
    const props = renderSidebar({ currentSegmentIndex: 1, solvedSegmentIds: new Set([1]) });
    fireEvent.click(screen.getByRole('button', { name: /replay/i }));

    expect(props.onReplaySegment).toHaveBeenCalledWith(0);
    expect(props.onSelectSegment).not.toHaveBeenCalled();
  });
});
