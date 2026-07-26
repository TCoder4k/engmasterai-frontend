import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import LessonStageStepper from './LessonStageStepper';
import { LessonStageId, StageStatus } from '../../services/lessonProgress';

// Sprint 06 — the five-stage stepper. Stages 3-5 need LessonTask/Question,
// which has models but no module and no API, so they must render with the
// same visual anatomy while being unmistakably unavailable: locked, not
// buttons, and never showing a progress status a student could act on.
const statuses = (over: Partial<Record<LessonStageId, StageStatus>> = {}): Record<
  LessonStageId,
  StageStatus
> => ({
  video: 'not_started',
  theory: 'not_started',
  quiz: 'locked',
  traphunter: 'locked',
  practice: 'locked',
  ...over,
});

const renderStepper = (
  over: Partial<Record<LessonStageId, StageStatus>> = {},
  current: LessonStageId = 'video',
  onSelect = vi.fn(),
) => {
  const utils = render(
    <LanguageProvider>
      <LessonStageStepper currentStage={current} statuses={statuses(over)} onSelectStage={onSelect} />
    </LanguageProvider>,
  );
  return { ...utils, onSelect };
};

afterEach(() => cleanup());

describe('LessonStageStepper — structure', () => {
  it('renders all five stages', () => {
    renderStepper();

    expect(screen.getByText('Video lesson')).toBeInTheDocument();
    expect(screen.getByText('Theory cards')).toBeInTheDocument();
    expect(screen.getByText('Quiz Part 5')).toBeInTheDocument();
    expect(screen.getByText('Trap Hunter')).toBeInTheDocument();
    expect(screen.getByText('Advanced practice')).toBeInTheDocument();
  });

  it('exposes only the two real stages as buttons', () => {
    renderStepper();

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
  });
});

describe('LessonStageStepper — locked stages', () => {
  it('marks stages 3-5 as coming soon, never as a startable status', () => {
    renderStepper();

    expect(screen.getAllByText('Coming soon')).toHaveLength(3);
    // Only the two real stages may say "Not started" — a locked stage
    // saying that would imply a student could begin it.
    expect(screen.getAllByText('Not started')).toHaveLength(2);
  });

  it('renders locked stages as aria-disabled, not as buttons', () => {
    renderStepper();

    expect(screen.queryByRole('button', { name: /Quiz Part 5/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Trap Hunter/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Advanced practice/ })).not.toBeInTheDocument();

    const disabled = document.querySelectorAll('[aria-disabled="true"]');
    expect(disabled).toHaveLength(3);
  });

  it('clicking a locked stage never selects it', async () => {
    const onSelect = vi.fn();
    renderStepper({}, 'video', onSelect);

    await userEvent.click(screen.getByText('Quiz Part 5'));

    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('LessonStageStepper — real stages', () => {
  it('selects a stage when its tile is clicked', async () => {
    const onSelect = vi.fn();
    renderStepper({}, 'video', onSelect);

    await userEvent.click(screen.getByRole('button', { name: /Theory cards/ }));

    expect(onSelect).toHaveBeenCalledWith('theory');
  });

  it('marks the current stage with aria-current="step"', () => {
    renderStepper({}, 'theory');

    expect(screen.getByRole('button', { name: /Theory cards/ })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('button', { name: /Video lesson/ })).not.toHaveAttribute('aria-current');
  });

  it('shows real completion and in-progress states', () => {
    renderStepper({ video: 'completed', theory: 'in_progress' });

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
  });

  it('shows an unavailable stage as not part of this lesson, and not selectable', () => {
    renderStepper({ theory: 'unavailable' });

    expect(screen.getByText('Not in this lesson')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Theory cards/ })).not.toBeInTheDocument();
  });
});

describe('LessonStageStepper — no fabricated data', () => {
  it('shows no percentage, XP or accuracy', () => {
    const { container } = renderStepper({ video: 'completed' });

    expect(container.textContent).not.toMatch(/%/);
    expect(container.textContent).not.toMatch(/XP/i);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
