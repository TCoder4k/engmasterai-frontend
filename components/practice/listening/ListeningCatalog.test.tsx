import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import ListeningCatalogPage from './ListeningCatalogPage';
import ListeningLessonPage from './ListeningLessonPage';
import { DICTATION_LESSONS } from './listeningContent';
import { clearListeningSessions } from './listeningSessionStore';

const renderAt = (path: string) =>
  render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/practice/listening" element={<ListeningCatalogPage />} />
            <Route path="/practice/listening/:lessonId" element={<ListeningLessonPage />} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </ThemeProvider>,
  );

beforeEach(() => clearListeningSessions());
afterEach(() => cleanup());

describe('Listening catalog (Sprint 03E)', () => {
  it('derives every count from the real dataset — the All chip equals the actual lesson count', () => {
    renderAt('/practice/listening');

    expect(screen.getByRole('button', { name: `All (${DICTATION_LESSONS.length})` })).toBeInTheDocument();
    // Every real lesson card renders.
    for (const lesson of DICTATION_LESSONS) {
      expect(screen.getByText(lesson.title)).toBeInTheDocument();
    }
    // No fabricated progress anywhere on first visit.
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('filters by topic with real per-topic counts', () => {
    renderAt('/practice/listening');

    const travelCount = DICTATION_LESSONS.filter((l) => l.topic === 'Travel').length;
    fireEvent.click(screen.getByRole('button', { name: `Travel (${travelCount})` }));

    expect(screen.getByText('Flight Delay Announcement')).toBeInTheDocument();
    expect(screen.queryByText('Office Relocation Notice')).not.toBeInTheDocument();
  });

  it('filters by level', () => {
    renderAt('/practice/listening');

    fireEvent.click(screen.getByRole('button', { name: 'A2' }));

    expect(screen.getByText('Ordering at a Café')).toBeInTheDocument();
    expect(screen.queryByText('Quarterly Sales Update')).not.toBeInTheDocument();
  });

  it('shows an honest empty state when no lesson matches the filters', () => {
    renderAt('/practice/listening');

    // Travel has no A2 lesson in the seed data.
    const travelCount = DICTATION_LESSONS.filter((l) => l.topic === 'Travel').length;
    fireEvent.click(screen.getByRole('button', { name: `Travel (${travelCount})` }));
    fireEvent.click(screen.getByRole('button', { name: 'A2' }));

    // Every lesson card is gone and the New Lessons section shows the empty
    // state ("No data yet" also exists in the sidebar's Level widget, so
    // assert scoped facts rather than a unique text match).
    for (const lesson of DICTATION_LESSONS) {
      expect(screen.queryByText(lesson.title)).not.toBeInTheDocument();
    }
    const newLessonsSection = screen.getByText('New lessons').closest('section');
    expect(newLessonsSection?.textContent).toContain('No data yet');
  });

  it('hides Continue Learning when no in-memory session exists', () => {
    renderAt('/practice/listening');
    expect(screen.queryByText('Continue Learning')).not.toBeInTheDocument();
  });

  it('a lesson card links to its /practice/listening/:lessonId route', () => {
    renderAt('/practice/listening');

    const card = screen.getByRole('link', { name: /office relocation notice/i });
    expect(card).toHaveAttribute('href', '/practice/listening/office-relocation-notice');
  });
});

describe('Listening lesson page', () => {
  it('renders the real lesson with a question counter and live word-diff status', () => {
    renderAt('/practice/listening/office-relocation-notice');

    expect(screen.getByText('Office Relocation Notice')).toBeInTheDocument();
    expect(screen.getByText(/Question 1\/5/)).toBeInTheDocument();
    expect(screen.getByText(/Match: 0%/)).toBeInTheDocument();
  });

  it('typing the full sentence solves the segment (100% match)', () => {
    renderAt('/practice/listening/office-relocation-notice');

    fireEvent.change(screen.getByPlaceholderText('Type what you hear'), {
      target: { value: 'Good morning everyone, thank you for joining this short briefing.' },
    });

    expect(screen.getByText(/Match: 100%/)).toBeInTheDocument();
  });

  it('an invalid lesson ID shows a safe not-found state with a way back', () => {
    renderAt('/practice/listening/does-not-exist');

    expect(screen.getByText('This listening lesson could not be found.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to listening/i })).toHaveAttribute(
      'href',
      '/practice/listening',
    );
  });
});
