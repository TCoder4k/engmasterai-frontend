import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import ListeningSessionSummary from './ListeningSessionSummary';

// Sprint 11 Phase 2 — rewritten for the backend-driven content model.
//
// The old fixture was a seed lesson and the old tests covered a "suggested
// next lessons" list built by ranking that seed array. Both are gone: the
// catalog is a paginated, permission-filtered API this component does not
// query, so any suggestion it produced would be a guess that could link to a
// recording the server would refuse. Its removal is asserted here so it cannot
// creep back as fabricated data.
//
// What survives is the part that was always the point: every figure on this
// card is a real count from the session that just happened, and the card says
// out loud that none of it is saved.
const baseProps = {
  title: 'Otter Moms Wrap Their Babies',
  level: 'B1',
  categoryName: 'Animals',
  totalSegments: 5,
  assistedCount: 0,
  wordsCorrect: 40,
  wordsTotal: 40,
  elapsedSeconds: 125,
  onReplayMistakes: vi.fn(),
  onReplayLesson: vi.fn(),
  onBackToLessons: vi.fn(),
};

const renderSummary = (overrides: Partial<typeof baseProps> = {}) => {
  const props = { ...baseProps, ...overrides };
  render(
    <LanguageProvider>
      <MemoryRouter>
        <ListeningSessionSummary {...props} />
      </MemoryRouter>
    </LanguageProvider>,
  );
  return props;
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ListeningSessionSummary — real figures only', () => {
  it('identifies the recording by its real title, category and level', () => {
    renderSummary();
    expect(screen.getByText('Otter Moms Wrap Their Babies')).toBeInTheDocument();
    expect(screen.getByText('Animals')).toBeInTheDocument();
    expect(screen.getByText('B1')).toBeInTheDocument();
  });

  it('derives accuracy from words, not from sentences reaching "solved"', () => {
    // Every sentence was completed, but a quarter of the words were revealed.
    renderSummary({ wordsCorrect: 30, wordsTotal: 40, assistedCount: 2 });
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('30/40')).toBeInTheDocument();
  });

  it('shows 0% rather than dividing by zero when no words were counted', () => {
    renderSummary({ wordsCorrect: 0, wordsTotal: 0 });
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('formats elapsed time instead of printing raw seconds', () => {
    renderSummary({ elapsedSeconds: 125 });
    expect(screen.getByText('02:05')).toBeInTheDocument();
  });

  it('states plainly that the result is not saved', () => {
    renderSummary();
    expect(screen.getByText(/kept for this session only/i)).toBeInTheDocument();
  });
});

describe('ListeningSessionSummary — actions', () => {
  it('offers Replay mistakes only when something needed help', () => {
    renderSummary({ assistedCount: 0 });
    expect(screen.queryByRole('button', { name: 'Replay mistakes' })).not.toBeInTheDocument();

    cleanup();
    const props = renderSummary({ assistedCount: 2 });
    fireEvent.click(screen.getByRole('button', { name: 'Replay mistakes' }));
    expect(props.onReplayMistakes).toHaveBeenCalledTimes(1);
  });

  it('can restart the whole recording and return to the catalog', () => {
    const props = renderSummary();

    fireEvent.click(screen.getByRole('button', { name: 'Replay lesson' }));
    expect(props.onReplayLesson).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Back to lessons' }));
    expect(props.onBackToLessons).toHaveBeenCalledTimes(1);
  });

  it('suggests no follow-up recordings — it has no honest source for them', () => {
    renderSummary();
    expect(screen.queryByText('Suggested next lessons')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
