import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import AdvancedPracticeStage from './AdvancedPracticeStage';
import * as practiceService from '../../../services/practiceService';

// Sprint 06D — the Advanced Practice orchestrator, driven against a mocked
// practiceService.
//
// The first block is the one this sprint exists for: rendering the stage must
// NOT start an attempt. The read is side-effect-free on the server, and the
// UI must not paper over that by auto-starting — a student who opens the tab
// and walks away has to record nothing.
//
// The suite runs on the reduced-motion path (vitest.setup.ts reports
// prefers-reduced-motion), which is the path that must stay fully functional
// with no animation at all.

vi.mock('../../../services/practiceService', async () => {
  const actual =
    await vi.importActual<typeof practiceService>('../../../services/practiceService');
  return {
    ...actual,
    getPractice: vi.fn(),
    startPractice: vi.fn(),
    answerPracticeQuestion: vi.fn(),
    submitPractice: vi.fn(),
  };
});

const mocked = practiceService as unknown as {
  getPractice: ReturnType<typeof vi.fn>;
  startPractice: ReturnType<typeof vi.fn>;
  answerPracticeQuestion: ReturnType<typeof vi.fn>;
  submitPractice: ReturnType<typeof vi.fn>;
};

const question = (id: string) => ({
  id,
  type: 'MULTIPLE_CHOICE' as const,
  difficulty: 'HARD' as const,
  content: `Question ${id}`,
  options: [
    { id: 'a', text: 'Alpha' },
    { id: 'b', text: 'Bravo' },
  ],
  audioUrl: null,
  imageUrl: null,
  orderIndex: 0,
  answered: null,
});

const overview = (over: Record<string, unknown> = {}) => ({
  availability: { state: 'available' as const },
  task: {
    taskId: 'task-1',
    questionCount: 2,
    passingScorePercent: 80,
    feedbackMode: 'IMMEDIATE' as const,
  },
  progress: {
    attemptsCount: 0,
    bestScorePercent: null,
    passed: false,
    lastDurationSeconds: null,
  },
  attempt: null,
  ...over,
});

const attempt = () => ({
  taskId: 'task-1',
  passingScorePercent: 80,
  feedbackMode: 'IMMEDIATE' as const,
  currentAttemptId: 'attempt-1',
  questions: [question('q1'), question('q2')],
});

const renderStage = () =>
  render(
    <MemoryRouter>
      <LanguageProvider>
        <AdvancedPracticeStage lessonId="lesson-1" />
      </LanguageProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocked.getPractice.mockResolvedValue(overview());
  mocked.startPractice.mockResolvedValue({
    task: overview().task,
    progress: overview().progress,
    attempt: attempt(),
  });
});

afterEach(cleanup);

describe('AdvancedPracticeStage — the intro starts nothing', () => {
  it('renders the intro with real authored numbers', async () => {
    renderStage();
    expect(await screen.findByText('Advanced Practice')).toBeInTheDocument();
    // Question count and passing score come from the server, not a guess.
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('does NOT call startPractice on render', async () => {
    renderStage();
    await screen.findByText('Advanced Practice');
    // The whole reason POST /practice/start exists. Merely opening the stage
    // must not create an attempt or stamp a duration.
    expect(mocked.startPractice).not.toHaveBeenCalled();
  });

  it('starts only when the student presses Start Practice', async () => {
    const user = userEvent.setup();
    renderStage();
    await user.click(await screen.findByRole('button', { name: /start practice/i }));
    expect(mocked.startPractice).toHaveBeenCalledWith('lesson-1');
    expect(await screen.findByText('Question q1')).toBeInTheDocument();
  });

  it('shows no estimated duration anywhere', async () => {
    renderStage();
    await screen.findByText('Advanced Practice');
    // No stored duration exists for a not-yet-started attempt, so none may
    // be displayed. A plausible guess is still a fabricated number.
    expect(screen.queryByText(/minute|min\b/i)).not.toBeInTheDocument();
  });
});

describe('AdvancedPracticeStage — availability', () => {
  it('explains WHICH prerequisite is missing when blocked on the quiz', async () => {
    mocked.getPractice.mockResolvedValue(
      overview({ availability: { state: 'blocked', reason: 'quiz_not_passed' } }),
    );
    renderStage();
    expect(await screen.findByText(/pass the lesson quiz first/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start practice/i })).not.toBeInTheDocument();
  });

  it('explains the trap prerequisite distinctly', async () => {
    mocked.getPractice.mockResolvedValue(
      overview({ availability: { state: 'blocked', reason: 'traps_outstanding' } }),
    );
    renderStage();
    expect(await screen.findByText(/clear your remaining traps/i)).toBeInTheDocument();
  });

  it('never says "Coming soon" for a blocked stage', async () => {
    mocked.getPractice.mockResolvedValue(
      overview({ availability: { state: 'blocked', reason: 'quiz_not_passed' } }),
    );
    renderStage();
    await screen.findByText(/pass the lesson quiz first/i);
    // 'blocked' is a live stage with an unmet prerequisite. Telling a student
    // a shipped feature does not exist is the bug 06B.5 fixed elsewhere.
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
  });

  it('reports honestly when the lesson has no practice task', async () => {
    mocked.getPractice.mockResolvedValue(
      overview({
        availability: { state: 'unavailable', reason: 'no_published_task' },
        task: null,
      }),
    );
    renderStage();
    expect(await screen.findByText(/not part of this lesson/i)).toBeInTheDocument();
  });
});

describe('AdvancedPracticeStage — answering', () => {
  it('grades on the server and reveals the authored explanation', async () => {
    const user = userEvent.setup();
    mocked.answerPracticeQuestion.mockResolvedValue({
      questionId: 'q1',
      isCorrect: true,
      correctAnswer: { optionId: 'a' },
      explanation: 'Because the clause is conditional.',
      answeredCount: 1,
      totalCount: 2,
      currentStreak: 1,
      allAnswered: false,
    });

    renderStage();
    await user.click(await screen.findByRole('button', { name: /start practice/i }));
    await user.click(await screen.findByText('Alpha'));
    await user.click(screen.getByRole('button', { name: /check answer/i }));

    expect(mocked.answerPracticeQuestion).toHaveBeenCalled();
    expect(await screen.findByText('Because the clause is conditional.')).toBeInTheDocument();
  });

  it('shows nothing where no explanation was authored', async () => {
    const user = userEvent.setup();
    mocked.answerPracticeQuestion.mockResolvedValue({
      questionId: 'q1',
      isCorrect: false,
      correctAnswer: { optionId: 'b' },
      explanation: null,
      answeredCount: 1,
      totalCount: 2,
      currentStreak: 0,
      allAnswered: false,
    });

    renderStage();
    await user.click(await screen.findByRole('button', { name: /start practice/i }));
    await user.click(await screen.findByText('Alpha'));
    await user.click(screen.getByRole('button', { name: /check answer/i }));

    // An absent explanation renders nothing — never a generated substitute.
    expect(screen.queryByText(/because/i)).not.toBeInTheDocument();
  });

  it('is fully operable by keyboard', async () => {
    const user = userEvent.setup();
    renderStage();
    await user.click(await screen.findByRole('button', { name: /start practice/i }));
    await screen.findByText('Question q1');

    await user.tab();
    // Something inside the stage takes focus rather than focus being lost or
    // trapped on the document body.
    expect(document.activeElement).not.toBe(document.body);
  });
});

describe('AdvancedPracticeStage — Enter checks and advances, not just a mouse click', () => {
  // Regression: QuizQuestionCard only wires its onEnter prop through to
  // FILL_BLANK; Multiple Choice, True/False and Ordering have no text input
  // of their own to catch a keypress, so they depend entirely on a wrapping
  // onKeyDown the stage previously never had. This deck of fixtures is
  // MULTIPLE_CHOICE, exactly the case that silently did nothing before.
  it('pressing Enter after selecting an option checks the answer, same as clicking Check answer', async () => {
    const user = userEvent.setup();
    mocked.answerPracticeQuestion.mockResolvedValue({
      questionId: 'q1',
      isCorrect: true,
      correctAnswer: { optionId: 'a' },
      explanation: null,
      answeredCount: 1,
      totalCount: 2,
      currentStreak: 1,
      allAnswered: false,
    });

    renderStage();
    await user.click(await screen.findByRole('button', { name: /start practice/i }));
    await user.click(await screen.findByText('Alpha'));

    await user.keyboard('{Enter}');

    expect(mocked.answerPracticeQuestion).toHaveBeenCalledWith(
      'lesson-1',
      expect.objectContaining({ questionId: 'q1' }),
    );
  });

  it('pressing Enter again after grading advances to the next question, without clicking Next', async () => {
    const user = userEvent.setup();
    mocked.answerPracticeQuestion.mockResolvedValue({
      questionId: 'q1',
      isCorrect: true,
      correctAnswer: { optionId: 'a' },
      explanation: null,
      answeredCount: 1,
      totalCount: 2,
      currentStreak: 1,
      allAnswered: false,
    });

    renderStage();
    await user.click(await screen.findByRole('button', { name: /start practice/i }));
    await user.click(await screen.findByText('Alpha'));
    await user.click(screen.getByRole('button', { name: /check answer/i }));
    // Grading complete once the primary button has switched from Check to Next.
    await screen.findByRole('button', { name: /^next/i });

    await user.keyboard('{Enter}');

    expect(await screen.findByText('Question q2')).toBeInTheDocument();
  });
});

describe('AdvancedPracticeStage — resume', () => {
  it('restores an in-flight attempt instead of showing the intro', async () => {
    mocked.getPractice.mockResolvedValue(overview({ attempt: attempt() }));
    renderStage();
    // A refresh mid-practice lands back on the questions, and crucially does
    // NOT offer Start again (which would risk a second attempt).
    expect(await screen.findByText('Question q1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start practice/i })).not.toBeInTheDocument();
    expect(mocked.startPractice).not.toHaveBeenCalled();
  });
});
