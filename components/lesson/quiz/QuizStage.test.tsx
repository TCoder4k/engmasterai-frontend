import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import QuizStage from './QuizStage';
import * as quizService from '../../../services/quizService';
import * as feedbackSounds from '../../../services/feedbackSounds';
import { Lesson } from '../../../types';

// Sprint 06B.5 — the Lesson Quiz Engine's student-facing orchestrator,
// rewritten for IMMEDIATE feedback. Exercised against a mocked quizService
// (not raw fetch) so a three-question, mixed-correctness attempt can be
// driven precisely:
//   - answering grades ONE question server-side and reveals its result;
//   - a graded question locks and cannot be re-answered;
//   - the explanation appears only where an author wrote one;
//   - the summary renders the SERVER's result, never a client-computed one;
//   - selecting an option never plays the "correct" sound, because at that
//     moment the client does not know whether it IS correct.
// The ON_SUBMIT path (Sprint 06B's original flow) is covered too, since it
// must keep working unchanged.

vi.mock('../../../services/quizService', async () => {
  const actual = await vi.importActual<typeof quizService>('../../../services/quizService');
  return {
    ...actual,
    getLessonQuiz: vi.fn(),
    // Sprint 07 — the GET is read-only now; starting an attempt is explicit.
    startLessonQuiz: vi.fn(),
    submitLessonQuiz: vi.fn(),
    answerQuizQuestion: vi.fn(),
  };
});

vi.mock('../../../services/feedbackSounds', async () => {
  const actual = await vi.importActual<typeof feedbackSounds>('../../../services/feedbackSounds');
  return {
    ...actual,
    playSelect: vi.fn(),
    playCorrect: vi.fn(),
    playIncorrect: vi.fn(),
    playComplete: vi.fn(),
  };
});

const QUESTIONS = [
  {
    id: 'q1',
    type: 'MULTIPLE_CHOICE' as const,
    difficulty: null,
    content: 'She ___ to work every day.',
    options: [
      { id: 'a', text: 'go' },
      { id: 'b', text: 'goes' },
    ],
    audioUrl: null,
    imageUrl: null,
    orderIndex: 0,
    answered: null as quizService.AnsweredQuestionState | null,
  },
  {
    id: 'q2',
    type: 'TRUE_FALSE' as const,
    difficulty: null,
    content: 'Present Simple can describe habits.',
    options: null,
    audioUrl: null,
    imageUrl: null,
    orderIndex: 1,
    answered: null as quizService.AnsweredQuestionState | null,
  },
  {
    id: 'q3',
    type: 'FILL_BLANK' as const,
    difficulty: null,
    content: 'Complete: I ___ (be) ready.',
    options: null,
    audioUrl: null,
    imageUrl: null,
    orderIndex: 2,
    answered: null as quizService.AnsweredQuestionState | null,
  },
];

const immediateQuiz = (): quizService.StudentQuiz => ({
  taskId: 'task-1',
  passingScorePercent: 70,
  feedbackMode: 'IMMEDIATE',
  questions: QUESTIONS.map((q) => ({ ...q })),
});

const SUBMIT_RESULT = {
  correctCount: 1,
  totalCount: 3,
  accuracyPercent: 33,
  passed: false,
  passingScorePercent: 70,
  attemptsCount: 1,
  bestScorePercent: 33,
  durationSeconds: 20,
  results: [
    {
      questionId: 'q1',
      isCorrect: false,
      submitted: { optionId: 'a' },
      correctAnswer: { optionId: 'b' },
      explanation: 'Third person singular takes -s.',
    },
    {
      questionId: 'q2',
      isCorrect: true,
      submitted: { value: true },
      correctAnswer: { value: true },
      explanation: null,
    },
    {
      questionId: 'q3',
      isCorrect: false,
      submitted: { text: 'no' },
      correctAnswer: { accepted: ['am'] },
      explanation: null,
    },
  ],
};

const LESSON: Lesson = {
  id: 'l-1',
  courseId: 'c-1',
  title: 'Present Simple',
  description: null,
  notes: null,
  videoUrl: 'https://youtu.be/abc',
  pdfUrl: null,
  audioUrl: null,
  videoDurationMinutes: null,
  estimatedStudyMinutes: null,
  learningObjectives: [],
  orderIndex: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  publishedTaskTypes: ['QUIZ'],
};

const renderStage = () =>
  render(
    <MemoryRouter>
      <LanguageProvider>
        <QuizStage
          lessonId="l-1"
          courseId="c-1"
          currentLesson={LESSON}
          allLessons={[LESSON]}
          userId="user-1"
        />
      </LanguageProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  // mockReset (not mockResolvedValue alone) so each test starts with a
  // clean call count — vi.restoreAllMocks() below does not clear plain
  // vi.fn() call history, only spy implementations.
  // Sprint 07 — `lastResult: null` is "never finished this before", which is
  // what every test in this file assumes. The dedicated block at the bottom
  // covers the non-null case.
  const freshQuiz = {
    quiz: immediateQuiz(),
    progress: { attemptsCount: 0, bestScorePercent: null, passed: false, lastDurationSeconds: null },
    lastResult: null,
  };
  vi.mocked(quizService.getLessonQuiz).mockReset().mockResolvedValue(freshQuiz);
  // A first attempt auto-starts, so the student lands on question 1 with no
  // extra click. The mock returns the same payload the GET did.
  vi.mocked(quizService.startLessonQuiz)
    .mockReset()
    .mockImplementation(async () => vi.mocked(quizService.getLessonQuiz).mock.results[0]
      ? await vi.mocked(quizService.getLessonQuiz)('l-1')
      : freshQuiz);
  vi.mocked(quizService.submitLessonQuiz).mockReset().mockResolvedValue(SUBMIT_RESULT);
  vi.mocked(quizService.answerQuizQuestion).mockReset();
  vi.mocked(feedbackSounds.playSelect).mockReset();
  vi.mocked(feedbackSounds.playCorrect).mockReset();
  vi.mocked(feedbackSounds.playIncorrect).mockReset();
  vi.mocked(feedbackSounds.playComplete).mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

const answerResponse = (
  questionId: string,
  isCorrect: boolean,
  correctAnswer: unknown,
  explanation: string | null,
  answeredCount: number,
  currentStreak = 0,
): quizService.AnswerQuestionResponse => ({
  questionId,
  isCorrect,
  correctAnswer,
  explanation,
  answeredCount,
  totalCount: 3,
  currentStreak,
  allAnswered: answeredCount >= 3,
});

describe('QuizStage — immediate feedback', () => {
  it('shows only the first question on load', async () => {
    renderStage();
    expect(await screen.findByText('She ___ to work every day.')).toBeInTheDocument();
    expect(screen.queryByText('Present Simple can describe habits.')).not.toBeInTheDocument();
  });

  it('grades one question at a time and reveals the authored explanation', async () => {
    vi.mocked(quizService.answerQuizQuestion).mockResolvedValue(
      answerResponse('q1', false, { optionId: 'b' }, 'Third person singular takes -s.', 1),
    );
    renderStage();
    await screen.findByText('She ___ to work every day.');

    await userEvent.click(screen.getByRole('radio', { name: /^go$/ })); // the wrong option
    await userEvent.click(screen.getByRole('button', { name: 'Check answer' }));

    expect(await screen.findByText('Not quite')).toBeInTheDocument();
    expect(screen.getByText(/Third person singular takes -s\./)).toBeInTheDocument();

    // The server was asked to grade exactly this one question.
    expect(quizService.answerQuizQuestion).toHaveBeenCalledTimes(1);
    const [, dto] = vi.mocked(quizService.answerQuizQuestion).mock.calls[0];
    expect(dto.questionId).toBe('q1');
    expect(dto.submitted).toEqual({ optionId: 'a' });
  });

  it('shows no explanation when the author wrote none', async () => {
    vi.mocked(quizService.answerQuizQuestion).mockResolvedValue(
      answerResponse('q1', true, { optionId: 'b' }, null, 1, 1),
    );
    renderStage();
    await screen.findByText('She ___ to work every day.');

    await userEvent.click(screen.getByRole('radio', { name: /goes/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Check answer' }));

    expect(await screen.findByText('Correct!')).toBeInTheDocument();
    // Nothing is invented to fill the gap.
    expect(screen.queryByText(/Explanation:/)).not.toBeInTheDocument();
  });

  it('locks a graded question — the answer can no longer be changed', async () => {
    vi.mocked(quizService.answerQuizQuestion).mockResolvedValue(
      answerResponse('q1', false, { optionId: 'b' }, null, 1),
    );
    renderStage();
    await screen.findByText('She ___ to work every day.');

    await userEvent.click(screen.getByRole('radio', { name: /^go$/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Check answer' }));
    await screen.findByText('Not quite');

    // Clicking the (now revealed) correct option changes nothing and never
    // reaches the network again.
    await userEvent.click(screen.getByRole('radio', { name: /goes/ }));
    expect(screen.getByRole('radio', { name: /^go$/ })).toHaveAttribute('aria-checked', 'true');
    expect(quizService.answerQuizQuestion).toHaveBeenCalledTimes(1);
  });

  it('advances to the next question once the current one is graded', async () => {
    vi.mocked(quizService.answerQuizQuestion).mockResolvedValue(
      answerResponse('q1', true, { optionId: 'b' }, null, 1, 1),
    );
    renderStage();
    await screen.findByText('She ___ to work every day.');

    await userEvent.click(screen.getByRole('radio', { name: /goes/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Check answer' }));
    await screen.findByText('Correct!');

    await userEvent.click(screen.getByRole('button', { name: 'Next question' }));
    expect(await screen.findByText('Present Simple can describe habits.')).toBeInTheDocument();
  });

  it('selecting an option acknowledges the choice without claiming it is correct', async () => {
    renderStage();
    await screen.findByText('She ___ to work every day.');

    await userEvent.click(screen.getByRole('radio', { name: /goes/ }));

    expect(feedbackSounds.playSelect).toHaveBeenCalled();
    // The client cannot know correctness at this point — the verdict sound
    // must not fire, or a selection would read as a verdict.
    expect(feedbackSounds.playCorrect).not.toHaveBeenCalled();
    expect(feedbackSounds.playIncorrect).not.toHaveBeenCalled();
    // And nothing has been graded yet.
    expect(quizService.answerQuizQuestion).not.toHaveBeenCalled();
  });

  it('restores already-graded questions after a reload, and reveals nothing about the rest', async () => {
    const resumed = immediateQuiz();
    resumed.questions[0].answered = {
      submitted: { optionId: 'a' },
      isCorrect: false,
      correctAnswer: { optionId: 'b' },
      explanation: 'Third person singular takes -s.',
    };
    vi.mocked(quizService.getLessonQuiz).mockResolvedValue({
      quiz: resumed,
      progress: { attemptsCount: 0, bestScorePercent: null, passed: false, lastDurationSeconds: null },
      lastResult: null,
    });

    renderStage();

    // Resumes at the first UNANSWERED question rather than restarting.
    expect(await screen.findByText('Present Simple can describe habits.')).toBeInTheDocument();

    // Going back shows the recorded verdict, read-only.
    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(await screen.findByText('She ___ to work every day.')).toBeInTheDocument();
    expect(screen.getByText('Not quite')).toBeInTheDocument();
    expect(screen.getByText(/Third person singular takes -s\./)).toBeInTheDocument();
  });

  it('finishes the attempt and renders the SERVER result, sending no answers of its own', async () => {
    let answered = 0;
    vi.mocked(quizService.answerQuizQuestion).mockImplementation((_lessonId, dto) => {
      answered += 1;
      return Promise.resolve(
        answerResponse(dto.questionId, false, { optionId: 'b' }, null, answered),
      );
    });

    renderStage();
    await screen.findByText('She ___ to work every day.');
    await userEvent.click(screen.getByRole('radio', { name: /^go$/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Check answer' }));
    await screen.findByText('Not quite');
    await userEvent.click(screen.getByRole('button', { name: 'Next question' }));

    await screen.findByText('Present Simple can describe habits.');
    await userEvent.click(screen.getByRole('radio', { name: 'True' }));
    await userEvent.click(screen.getByRole('button', { name: 'Check answer' }));
    await screen.findByText('Not quite');
    await userEvent.click(screen.getByRole('button', { name: 'Next question' }));

    await screen.findByText('Complete: I ___ (be) ready.');
    await userEvent.type(screen.getByPlaceholderText('Type your answer'), 'no');
    await userEvent.click(screen.getByRole('button', { name: 'Check answer' }));
    await screen.findByText('Not quite');
    await userEvent.click(screen.getByRole('button', { name: 'Finish quiz' }));

    expect(await screen.findByText('Quiz summary')).toBeInTheDocument();
    // The pass/fail line comes from the SERVER's response, not from the
    // three wrong answers the client happens to know about.
    expect(
      screen.getByText("You haven't reached the passing score yet — you can try again."),
    ).toBeInTheDocument();

    expect(quizService.submitLessonQuiz).toHaveBeenCalledTimes(1);
    const [, dto] = vi.mocked(quizService.submitLessonQuiz).mock.calls[0];
    // Under IMMEDIATE the server scores from its own record, so the client
    // deliberately reports nothing — it has been told every correct answer
    // by this point and is no longer a trustworthy source.
    expect(dto.answers).toBeUndefined();
  });
});

describe('QuizStage — ON_SUBMIT mode still works (Sprint 06B flow)', () => {
  beforeEach(() => {
    vi.mocked(quizService.getLessonQuiz).mockResolvedValue({
      quiz: { ...immediateQuiz(), feedbackMode: 'ON_SUBMIT' },
      progress: { attemptsCount: 0, bestScorePercent: null, passed: false, lastDurationSeconds: null },
      lastResult: null,
    });
  });

  it('collects every answer, grades nothing along the way, and submits once', async () => {
    renderStage();
    await screen.findByText('She ___ to work every day.');

    await userEvent.click(screen.getByRole('radio', { name: /^go$/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    await screen.findByText('Present Simple can describe habits.');
    await userEvent.click(screen.getByRole('radio', { name: 'True' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    await screen.findByText('Complete: I ___ (be) ready.');
    await userEvent.type(screen.getByPlaceholderText('Type your answer'), 'no');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('Quiz summary')).toBeInTheDocument();
    // No per-question grading happened at any point in this mode.
    expect(quizService.answerQuizQuestion).not.toHaveBeenCalled();
    const [, dto] = vi.mocked(quizService.submitLessonQuiz).mock.calls[0];
    expect(dto.answers).toHaveLength(3);
  });

  it('Previous/Next preserve already-given answers', async () => {
    renderStage();
    await screen.findByText('She ___ to work every day.');

    await userEvent.click(screen.getByRole('radio', { name: /goes/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Present Simple can describe habits.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(await screen.findByText('She ___ to work every day.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /goes/ })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('QuizStage — keyboard', () => {
  it('selects an option with a number key and checks it with Enter', async () => {
    vi.mocked(quizService.answerQuizQuestion).mockResolvedValue(
      answerResponse('q1', true, { optionId: 'b' }, null, 1, 1),
    );
    renderStage();
    await screen.findByText('She ___ to work every day.');

    // Focus a real focusable descendant — the radiogroup <div> isn't in the
    // tab order, and a keydown only bubbles up from wherever focus is.
    screen.getByRole('radio', { name: /^go$/ }).focus();
    await userEvent.keyboard('2'); // selects the second option ("goes")
    expect(screen.getByRole('radio', { name: /goes/ })).toHaveAttribute('aria-checked', 'true');

    await userEvent.keyboard('{Enter}');
    expect(await screen.findByText('Correct!')).toBeInTheDocument();
  });
});

// SPRINT 07 — the reported bug: "a completed quiz does not reliably restore
// its previous result in another browser session."
//
// The cause was entirely client-side. loadQuiz ended unconditionally with
// `setSubmitResult(null); setPhase('answering')`, so reopening a finished quiz
// always dropped the student into a blank question 1 — and because the GET
// also started an attempt as a side effect, that reset was silently recorded
// server-side too. The stored result arrived in the response and was never
// rendered.
describe('QuizStage — a finished quiz restores its stored summary', () => {
  const passedResult = {
    ...SUBMIT_RESULT,
    correctCount: 3,
    accuracyPercent: 100,
    passed: true,
    bestScorePercent: 100,
    results: SUBMIT_RESULT.results.map((r) => ({ ...r, isCorrect: true })),
  };

  const mockFinishedQuiz = () => {
    vi.mocked(quizService.getLessonQuiz).mockResolvedValue({
      // currentAttemptId null == no attempt in flight.
      quiz: { ...immediateQuiz(), currentAttemptId: null },
      progress: {
        attemptsCount: 1,
        bestScorePercent: 100,
        passed: true,
        lastDurationSeconds: 42,
      },
      lastResult: passedResult,
    });
  };

  it('shows the stored result instead of a blank first question', async () => {
    mockFinishedQuiz();
    renderStage();

    // The summary, with the REAL stored numbers.
    expect(await screen.findByText('3/3')).toBeInTheDocument();
    // Not dropped back into the quiz.
    expect(screen.queryByText('She ___ to work every day.')).not.toBeInTheDocument();
  });

  it('starts NOTHING when a finished quiz is merely reopened', async () => {
    mockFinishedQuiz();
    renderStage();
    await screen.findByText('3/3');

    // The whole point: revisiting must not consume an attempt. Before Sprint
    // 07 this was unavoidable, because the GET itself did the starting.
    expect(quizService.startLessonQuiz).not.toHaveBeenCalled();
  });

  it('offers a retry even after PASSING, and only that begins a new attempt', async () => {
    // Previously the retry button rendered only when `!result.passed`, so a
    // student who passed had no way back in from this screen.
    mockFinishedQuiz();
    renderStage();
    await screen.findByText('3/3');

    const retry = screen.getByRole('button', { name: /try again/i });
    expect(retry).toBeInTheDocument();

    vi.mocked(quizService.startLessonQuiz).mockResolvedValue({
      quiz: immediateQuiz(),
      progress: {
        attemptsCount: 1,
        bestScorePercent: 100,
        passed: true,
        lastDurationSeconds: 42,
      },
      lastResult: null,
    });

    await userEvent.click(retry);

    expect(quizService.startLessonQuiz).toHaveBeenCalledWith('l-1');
    expect(await screen.findByText('She ___ to work every day.')).toBeInTheDocument();
  });
});
