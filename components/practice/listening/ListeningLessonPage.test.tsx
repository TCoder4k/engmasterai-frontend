import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import ListeningLessonPage from './ListeningLessonPage';
import { clearListeningSessions } from './listeningSessionStore';
import { getLessonById } from './listeningContent';

// Real word counts for the office-relocation-notice lesson, computed the
// same way the component does (split on spaces) — never hand-typed magic
// numbers, so this can't silently drift from the actual Accuracy formula.
const OFFICE_LESSON = getLessonById('office-relocation-notice')!;
const wordCount = (textEn: string) => textEn.split(' ').length;
const OFFICE_TOTAL_WORDS = OFFICE_LESSON.segments.reduce((sum, s) => sum + wordCount(s.textEn), 0);

// Sprint 03F: the page-level duplicate Previous/Next row is gone (single
// Next action lives inside DictationWorkspace), a real session-complete
// screen exists for the first time, and the auto-advance timer is now
// ref-tracked so a manual advance can't race it into a double-advance.
const renderLesson = (lessonId = 'office-relocation-notice') =>
  render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={[`/practice/listening/${lessonId}`]}>
          <Routes>
            <Route path="/practice/listening" element={<div>CATALOG PAGE</div>} />
            <Route path="/practice/listening/:lessonId" element={<ListeningLessonPage />} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </ThemeProvider>,
  );

const solveCurrentSegment = (textEn: string) => {
  fireEvent.change(screen.getByPlaceholderText('Type what you hear'), { target: { value: textEn } });
};

const OFFICE_SEGMENTS = [
  'Good morning everyone, thank you for joining this short briefing.',
  'Starting next Monday, our office will move to the third floor.',
  'Please pack your personal belongings into the boxes provided by Friday.',
  'The new workstations already have updated network cables installed.',
  'If you have any questions, please contact the facilities team directly.',
];

beforeEach(() => clearListeningSessions());
afterEach(() => cleanup());

describe('ListeningLessonPage — single next-action control', () => {
  it('has exactly one Next control and no Previous button anywhere in the workspace', () => {
    renderLesson();
    expect(screen.getAllByRole('button', { name: 'Next >' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
  });

  it('clicking Next after solving advances exactly once', () => {
    renderLesson();
    expect(screen.getByText(/Question 1\/5/)).toBeInTheDocument();

    solveCurrentSegment(OFFICE_SEGMENTS[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Next >' }));

    expect(screen.getByText(/Question 2\/5/)).toBeInTheDocument();
  });

  it('Enter advances exactly once when solved', () => {
    renderLesson();
    solveCurrentSegment(OFFICE_SEGMENTS[0]);
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(screen.getByText(/Question 2\/5/)).toBeInTheDocument();
  });
});

describe('ListeningLessonPage — final segment completion', () => {
  it('solving the last segment and clicking Next opens the real session-complete screen with real counts', () => {
    renderLesson();

    for (let i = 0; i < OFFICE_SEGMENTS.length; i++) {
      solveCurrentSegment(OFFICE_SEGMENTS[i]);
      fireEvent.click(screen.getByRole('button', { name: 'Next >' }));
    }

    expect(screen.getByText('Listening Complete')).toBeInTheDocument();
    // A perfect run: every word typed correctly, none revealed.
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText(`${OFFICE_TOTAL_WORDS}/${OFFICE_TOTAL_WORDS}`)).toBeInTheDocument();
    // A perfect run has nothing to replay.
    expect(screen.queryByRole('button', { name: 'Replay mistakes' })).not.toBeInTheDocument();
  });

  it('Replay lesson resets progress and returns to the first segment', () => {
    renderLesson();
    for (let i = 0; i < OFFICE_SEGMENTS.length; i++) {
      solveCurrentSegment(OFFICE_SEGMENTS[i]);
      fireEvent.click(screen.getByRole('button', { name: 'Next >' }));
    }

    fireEvent.click(screen.getByRole('button', { name: 'Replay lesson' }));

    expect(screen.getByText(/Question 1\/5/)).toBeInTheDocument();
    expect(screen.getByText(/Match: 0%/)).toBeInTheDocument();
  });

  it('Back to lessons navigates to the catalog', () => {
    renderLesson();
    for (let i = 0; i < OFFICE_SEGMENTS.length; i++) {
      solveCurrentSegment(OFFICE_SEGMENTS[i]);
      fireEvent.click(screen.getByRole('button', { name: 'Next >' }));
    }

    fireEvent.click(screen.getByRole('button', { name: 'Back to lessons' }));
    expect(screen.getByText('CATALOG PAGE')).toBeInTheDocument();
  });

  it('Replay mistakes jumps straight to the first assisted segment', () => {
    renderLesson();

    // Segment 1: solved unassisted.
    solveCurrentSegment(OFFICE_SEGMENTS[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Next >' }));

    // Segment 2: solved via Reveal all — assisted.
    fireEvent.click(screen.getByRole('button', { name: 'Reveal all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next >' }));

    // Segments 3-5: solved unassisted.
    for (let i = 2; i < OFFICE_SEGMENTS.length; i++) {
      solveCurrentSegment(OFFICE_SEGMENTS[i]);
      fireEvent.click(screen.getByRole('button', { name: 'Next >' }));
    }

    // Segment 2 was fully revealed — its words don't count toward
    // wordsCorrect, computed the same way the component does.
    const revealedSegmentWords = wordCount(OFFICE_LESSON.segments[1].textEn);
    const expectedAccuracy = Math.round(
      ((OFFICE_TOTAL_WORDS - revealedSegmentWords) / OFFICE_TOTAL_WORDS) * 100,
    );
    expect(screen.getByText(`${expectedAccuracy}%`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Replay mistakes' }));

    // Jumps directly to segment 2 (the only assisted one), not segment 1.
    expect(screen.getByText(/Question 2\/5/)).toBeInTheDocument();
    expect(screen.getByText(/Match: 0%/)).toBeInTheDocument();
  });
});

describe('ListeningLessonPage — lesson-to-lesson navigation reset', () => {
  it('clicking Next Lesson on the summary navigates to a different lesson with fresh progress', () => {
    renderLesson();
    for (let i = 0; i < OFFICE_SEGMENTS.length; i++) {
      solveCurrentSegment(OFFICE_SEGMENTS[i]);
      fireEvent.click(screen.getByRole('button', { name: 'Next >' }));
    }
    expect(screen.getByText('Listening Complete')).toBeInTheDocument();

    // React Router reuses this same mounted component for the new
    // lessonId — the explicit [lessonId] reset effect must clear
    // segmentIndex/solved/word stats rather than leaking them forward.
    fireEvent.click(screen.getByRole('link', { name: 'Next Lesson' }));

    expect(screen.getByText(/Question 1\/5/)).toBeInTheDocument();
    expect(screen.getByText(/Match: 0%/)).toBeInTheDocument();
    expect(screen.queryByText('Office Relocation Notice')).not.toBeInTheDocument();
  });
});

describe('ListeningLessonPage — auto-advance timer hygiene', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a manual advance cancels a pending auto-advance timer (no double-advance)', () => {
    renderLesson();
    fireEvent.click(screen.getByRole('checkbox', { name: /auto-advance/i }));

    solveCurrentSegment(OFFICE_SEGMENTS[0]);
    // Manually advance immediately, before the 1200ms auto-advance timer
    // would fire.
    fireEvent.click(screen.getByRole('button', { name: 'Next >' }));
    expect(screen.getByText(/Question 2\/5/)).toBeInTheDocument();

    // If the stale timer weren't cancelled, this would silently skip ahead
    // to segment 3.
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.getByText(/Question 2\/5/)).toBeInTheDocument();
  });

  it('auto-advance itself still works when left uncancelled', () => {
    renderLesson();
    fireEvent.click(screen.getByRole('checkbox', { name: /auto-advance/i }));

    solveCurrentSegment(OFFICE_SEGMENTS[0]);
    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(screen.getByText(/Question 2\/5/)).toBeInTheDocument();
  });
});
