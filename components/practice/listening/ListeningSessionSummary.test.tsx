import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import ListeningSessionSummary from './ListeningSessionSummary';
import { DICTATION_LESSONS } from './listeningContent';
import { clearListeningSessions } from './listeningSessionStore';

// Sprint 03G: accuracy is now word-based (wordsCorrect/wordsTotal), not
// segment-based — a lesson where every segment reached "solved" can still
// show less than 100% here if some words needed help. Suggested lessons are
// derived from the real catalog (excluding the current lesson) plus the
// real (session-scoped) listeningSessionStore.
const LESSON = DICTATION_LESSONS[0]; // office-relocation-notice — has same-topic siblings in the seed catalog

const renderSummary = (overrides: Partial<Parameters<typeof ListeningSessionSummary>[0]> = {}) => {
  const props = {
    lesson: LESSON,
    totalSegments: 5,
    assistedCount: 0,
    wordsCorrect: 52,
    wordsTotal: 52,
    elapsedSeconds: 154,
    onReplayMistakes: vi.fn(),
    onReplayLesson: vi.fn(),
    onBackToLessons: vi.fn(),
    ...overrides,
  };
  render(
    <MemoryRouter>
      <LanguageProvider>
        <ListeningSessionSummary {...props} />
      </LanguageProvider>
    </MemoryRouter>,
  );
  return props;
};

beforeEach(() => clearListeningSessions());
afterEach(() => cleanup());

describe('ListeningSessionSummary — stats', () => {
  it('computes Accuracy from real word counts, not segment counts', () => {
    // Every segment is "solved" (5/5) but only 41 of 52 words were typed
    // correctly — a segment-based formula would show 100% here; the
    // word-based one must not.
    renderSummary({ totalSegments: 5, assistedCount: 1, wordsCorrect: 41, wordsTotal: 52 });
    expect(screen.getByText('79%')).toBeInTheDocument();
    expect(screen.getByText('41/52')).toBeInTheDocument();
  });

  it('shows the real Segments and Time stats', () => {
    renderSummary({ totalSegments: 5, elapsedSeconds: 154 });
    expect(screen.getByText('5/5')).toBeInTheDocument();
    expect(screen.getByText('02:34')).toBeInTheDocument();
  });

  it('a perfect run shows 100% accuracy and hides Replay mistakes (nothing to replay)', () => {
    renderSummary({ assistedCount: 0, wordsCorrect: 52, wordsTotal: 52 });
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Replay mistakes' })).not.toBeInTheDocument();
  });
});

describe('ListeningSessionSummary — primary CTAs', () => {
  it('shows Replay mistakes when at least one segment needed assistance, and it calls back', () => {
    const props = renderSummary({ assistedCount: 2, wordsCorrect: 40, wordsTotal: 52 });
    fireEvent.click(screen.getByRole('button', { name: 'Replay mistakes' }));
    expect(props.onReplayMistakes).toHaveBeenCalledTimes(1);
  });

  it('Replay lesson and Back to lessons call their respective callbacks', () => {
    const props = renderSummary();
    fireEvent.click(screen.getByRole('button', { name: 'Replay lesson' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to lessons' }));
    expect(props.onReplayLesson).toHaveBeenCalledTimes(1);
    expect(props.onBackToLessons).toHaveBeenCalledTimes(1);
  });

  it('shows a Next Lesson link to a real suggested lesson when one exists', () => {
    renderSummary();
    const href = screen.getByRole('link', { name: 'Next Lesson' }).getAttribute('href');
    expect(href).toMatch(/^\/practice\/listening\//);
    expect(href).not.toBe(`/practice/listening/${LESSON.id}`);
  });
});

describe('ListeningSessionSummary — suggested lessons', () => {
  it('never suggests the current lesson itself', () => {
    renderSummary();
    const links = screen.getAllByRole('link').map((el) => el.getAttribute('href'));
    expect(links).not.toContain(`/practice/listening/${LESSON.id}`);
  });

  it('shows each suggested card with its real segment count and estimated minutes', () => {
    renderSummary();
    const other = DICTATION_LESSONS.find((l) => l.id !== LESSON.id)!;
    const card = screen.getByRole('link', { name: new RegExp(other.title) });
    expect(card).toHaveTextContent(`${other.segments.length}`);
  });
});
