import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import ContinueLearningCard from './ContinueLearningCard';
import { RecentActivityEntry } from '../../services/recentActivity';

// Sprint 05 — Continue Learning became module-aware. The priority order it
// implements is a product decision, so it is asserted directly here:
//   Grammar -> due vocabulary review -> Listening -> plain recency -> empty.
//
// Steps 1/3/4 read the client-side ring buffer, which is why these tests
// write localStorage rather than mocking a service.
const USER = { id: 'user-1', name: 'Tu Nguyen', email: 't@example.com', role: 'USER' };

const entry = (over: Partial<RecentActivityEntry>): RecentActivityEntry => ({
  type: 'lesson',
  id: 'l-1',
  title: 'Some lesson',
  path: '/courses/c-1/lessons/l-1',
  openedAt: '2026-07-20T00:00:00.000Z',
  ...over,
});

const seedActivity = (entries: RecentActivityEntry[]) =>
  localStorage.setItem(`recentActivity:${USER.id}`, JSON.stringify(entries));

const renderCard = (dueTotal: number | null = null) =>
  render(
    <LanguageProvider>
      <MemoryRouter initialEntries={['/home']}>
        <ContinueLearningCard dueTotal={dueTotal} />
      </MemoryRouter>
    </LanguageProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('user', JSON.stringify(USER));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('ContinueLearningCard — priority order', () => {
  it('prefers a Grammar lesson over a more recent Vocabulary one', () => {
    seedActivity([
      entry({ id: 'v-1', title: 'Vocabulary deck', courseType: 'VOCABULARY', openedAt: '2026-07-25T00:00:00.000Z' }),
      entry({
        id: 'g-1',
        title: 'Present Perfect',
        courseType: 'GRAMMAR',
        path: '/courses/c-1/lessons/g-1',
        openedAt: '2026-07-01T00:00:00.000Z',
      }),
    ]);

    renderCard(9);

    expect(screen.getByText('Present Perfect')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue' })).toHaveAttribute('href', '/courses/c-1/lessons/g-1');
  });

  it('offers the vocabulary review when there is no Grammar activity and words are due', () => {
    seedActivity([entry({ id: 'ls-1', title: 'Listening lesson', courseType: 'LISTENING' })]);

    renderCard(9);

    expect(screen.getByText('Vocabulary review')).toBeInTheDocument();
    expect(screen.getByText('9 words due today')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue' })).toHaveAttribute('href', '/practice/review');
  });

  it('falls back to Listening when nothing is due', () => {
    seedActivity([
      entry({ id: 'ls-1', title: 'Listening lesson', courseType: 'LISTENING', path: '/practice/listening/ls-1' }),
    ]);

    renderCard(0);

    expect(screen.getByText('Listening lesson')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue' })).toHaveAttribute('href', '/practice/listening/ls-1');
  });

  it('falls back to plain recency for legacy entries with no courseType', () => {
    // Entries written before Sprint 05 are already in real users'
    // localStorage without the field — they must still work.
    seedActivity([entry({ id: 'old-1', title: 'Legacy lesson', path: '/courses/c-9/lessons/old-1' })]);

    renderCard(null);

    expect(screen.getByText('Legacy lesson')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue' })).toHaveAttribute('href', '/courses/c-9/lessons/old-1');
  });

  it('never treats an unknown due total as due words', () => {
    seedActivity([]);
    renderCard(null);

    expect(screen.queryByText('Vocabulary review')).not.toBeInTheDocument();
    expect(screen.getByText('No learning activity yet')).toBeInTheDocument();
  });

  it('keeps the original honest empty state when nothing has been opened', () => {
    renderCard(0);

    expect(screen.getByText('No learning activity yet')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Continue' })).not.toBeInTheDocument();
  });
});

describe('ContinueLearningCard — no fabricated progress', () => {
  it('renders no percentage or progress bar', () => {
    seedActivity([entry({ id: 'g-1', title: 'Present Perfect', courseType: 'GRAMMAR' })]);

    const { container } = renderCard(3);

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/%/);
  });
});
