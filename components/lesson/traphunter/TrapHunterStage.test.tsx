import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import TrapHunterStage from './TrapHunterStage';
import * as trapHunterService from '../../../services/trapHunterService';
import * as feedbackSounds from '../../../services/feedbackSounds';

// Sprint 06C — the correction round's orchestrator, exercised against a
// mocked trapHunterService so a mixed run can be driven precisely:
//   - ONLY questions the student got wrong appear;
//   - a missed correction re-queues to the BACK and comes round again;
//   - a corrected trap leaves the queue and the stage completes;
//   - an explanation appears only where an author wrote one;
//   - no hint control at all when the question has no hint source;
//   - the nudge appears after 2 misses and STILL requires a click;
//   - taking a hint changes nothing about clearing the trap;
//   - the whole flow is reachable by keyboard alone.
//
// The suite runs on the reduced-motion path (vitest.setup.ts reports
// prefers-reduced-motion), which is precisely the path that must stay
// completely functional with no animation at all.

vi.mock('../../../services/trapHunterService', async () => {
  const actual =
    await vi.importActual<typeof trapHunterService>('../../../services/trapHunterService');
  return {
    ...actual,
    getTrapHunter: vi.fn(),
    answerTrap: vi.fn(),
    requestTrapHint: vi.fn(),
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

const trap = (over: Partial<trapHunterService.Trap> = {}): trapHunterService.Trap => ({
  questionId: 't1',
  type: 'MULTIPLE_CHOICE',
  difficulty: 'MEDIUM',
  content: 'She ___ to work every day.',
  options: [
    { id: 'a', text: 'go' },
    { id: 'b', text: 'goes' },
    { id: 'c', text: 'going' },
    { id: 'd', text: 'gone' },
  ],
  audioUrl: null,
  imageUrl: null,
  wrongAnswer: { optionId: 'a' },
  attempts: 0,
  hintLevel: 0,
  hintsAvailable: 2,
  hints: [],
  cleared: null,
  ...over,
});

const response = (
  traps: trapHunterService.Trap[],
  over: Partial<trapHunterService.TrapHunterProgress> = {},
): trapHunterService.GetTrapHunterResponse => ({
  traps,
  progress: {
    hasSource: true,
    total: traps.length,
    cleared: traps.filter((t) => t.cleared).length,
    completed: false,
    ...over,
  },
});

const answer = (
  over: Partial<trapHunterService.AnswerTrapResponse> = {},
): trapHunterService.AnswerTrapResponse => ({
  questionId: 't1',
  isCorrect: true,
  correctAnswer: { optionId: 'b' },
  explanation: 'Third person singular takes -s.',
  attempts: 0,
  clearedCount: 1,
  totalCount: 1,
  currentStreak: 1,
  allCleared: true,
  ...over,
});

const renderStage = (
  onProgressChange?: (p: trapHunterService.TrapHunterProgress) => void,
  handlers: { onGoToQuiz?: () => void; onGoToPractice?: () => void } = {},
) =>
  render(
    <MemoryRouter>
      <LanguageProvider>
        <TrapHunterStage
          lessonId="l-1"
          onProgressChange={onProgressChange}
          {...handlers}
        />
      </LanguageProvider>
    </MemoryRouter>,
  );

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('what appears in the queue', () => {
  it('shows only questions the student got wrong', async () => {
    vi.mocked(trapHunterService.getTrapHunter).mockResolvedValue(
      response([trap({ questionId: 't1', content: 'The missed one.' })]),
    );
    renderStage();

    expect(await screen.findByText('The missed one.')).toBeInTheDocument();
    // Nothing invents a second trap out of the rest of the quiz.
    expect(screen.getByText(/1\/1/)).toBeInTheDocument();
  });

  it("echoes the student's own wrong answer as the thing being corrected", async () => {
    vi.mocked(trapHunterService.getTrapHunter).mockResolvedValue(
      response([trap({ wrongAnswer: { optionId: 'a' } })]),
    );
    renderStage();

    expect(await screen.findByText(/You answered/)).toBeInTheDocument();
    // 'go' is option a — the wrong pick, shown struck through.
    expect(screen.getAllByText('go').length).toBeGreaterThan(0);
  });

  it('says "finish the quiz first" — never "coming soon" — before any attempt', async () => {
    vi.mocked(trapHunterService.getTrapHunter).mockResolvedValue(
      response([], { hasSource: false, total: 0 }),
    );
    renderStage();

    expect(await screen.findByText('Finish the quiz first')).toBeInTheDocument();
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
  });

  it('celebrates a perfect quiz rather than reporting a missing feature', async () => {
    vi.mocked(trapHunterService.getTrapHunter).mockResolvedValue(
      response([], { hasSource: true, total: 0 }),
    );
    renderStage();

    expect(await screen.findByText('No traps to hunt')).toBeInTheDocument();
    expect(screen.queryByText(/not in this lesson/i)).not.toBeInTheDocument();
  });
});

describe('correcting a trap', () => {
  it('clears it, plays the correct sound, and finishes the round', async () => {
    const user = userEvent.setup();
    const onProgressChange = vi.fn();
    vi.mocked(trapHunterService.getTrapHunter).mockResolvedValue(response([trap()]));
    vi.mocked(trapHunterService.answerTrap).mockResolvedValue(answer());
    renderStage(onProgressChange);

    await user.click(await screen.findByRole('radio', { name: /goes/ }));
    await user.click(screen.getByRole('button', { name: 'Check correction' }));

    expect(await screen.findByText('Trap cleared')).toBeInTheDocument();
    expect(feedbackSounds.playCorrect).toHaveBeenCalled();
    expect(feedbackSounds.playIncorrect).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Finish/ }));
    expect(await screen.findByText('Every trap cleared')).toBeInTheDocument();
    expect(onProgressChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ cleared: 1, completed: true }),
    );
  });

  it('selecting an option never plays the "correct" sound — the client does not know yet', async () => {
    const user = userEvent.setup();
    vi.mocked(trapHunterService.getTrapHunter).mockResolvedValue(response([trap()]));
    renderStage();

    await user.click(await screen.findByRole('radio', { name: /goes/ }));
    expect(feedbackSounds.playSelect).toHaveBeenCalled();
    expect(feedbackSounds.playCorrect).not.toHaveBeenCalled();
  });

  it('re-queues a missed trap to the BACK rather than marking it wrong and losing it', async () => {
    const user = userEvent.setup();
    vi.mocked(trapHunterService.getTrapHunter).mockResolvedValue(
      response([
        trap({ questionId: 't1', content: 'First trap.' }),
        trap({ questionId: 't2', content: 'Second trap.' }),
      ]),
    );
    vi.mocked(trapHunterService.answerTrap).mockResolvedValue(
      answer({ isCorrect: false, attempts: 1, clearedCount: 0, totalCount: 2, allCleared: false }),
    );
    renderStage();

    expect(await screen.findByText('First trap.')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /^go$/ }));
    await user.click(screen.getByRole('button', { name: 'Check correction' }));

    expect(await screen.findByText('Not yet — this one comes back')).toBeInTheDocument();
    // And it says so, so the rose panel doesn't read as a final verdict.
    expect(screen.getByText('This trap returns later in the round.')).toBeInTheDocument();
    expect(feedbackSounds.playIncorrect).toHaveBeenCalledTimes(1);

    // Next goes to the OTHER trap, not back to the same one.
    await user.click(screen.getByRole('button', { name: /Next trap/ }));
    expect(await screen.findByText('Second trap.')).toBeInTheDocument();
    expect(screen.queryByText('First trap.')).not.toBeInTheDocument();
  });

  it('clears the previous attempt when a trap comes back, so it must be answered again', async () => {
    const user = userEvent.setup();
    vi.mocked(trapHunterService.getTrapHunter).mockResolvedValue(
      response([trap({ questionId: 't1', content: 'Only trap.' })]),
    );
    vi.mocked(trapHunterService.answerTrap).mockResolvedValue(
      answer({ isCorrect: false, attempts: 1, clearedCount: 0, allCleared: false }),
    );
    renderStage();

    await user.click(await screen.findByRole('radio', { name: /^go$/ }));
    await user.click(screen.getByRole('button', { name: 'Check correction' }));
    await screen.findByText('Not yet — this one comes back');
    await user.click(screen.getByRole('button', { name: /Next trap/ }));

    // Same trap, but nothing selected and the primary button disabled again.
    expect(await screen.findByText('Only trap.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check correction' })).toBeDisabled();
  });
});

describe('explanations are authored or absent', () => {
  it('renders the explanation an author wrote', async () => {
    const user = userEvent.setup();
    vi.mocked(trapHunterService.getTrapHunter).mockResolvedValue(response([trap()]));
    vi.mocked(trapHunterService.answerTrap).mockResolvedValue(answer());
    renderStage();

    await user.click(await screen.findByRole('radio', { name: /goes/ }));
    await user.click(screen.getByRole('button', { name: 'Check correction' }));
    expect(await screen.findByText(/Third person singular takes -s\./)).toBeInTheDocument();
  });

  it('renders nothing at all when none was written — never a generated substitute', async () => {
    const user = userEvent.setup();
    vi.mocked(trapHunterService.getTrapHunter).mockResolvedValue(response([trap()]));
    vi.mocked(trapHunterService.answerTrap).mockResolvedValue(answer({ explanation: null }));
    renderStage();

    await user.click(await screen.findByRole('radio', { name: /goes/ }));
    await user.click(screen.getByRole('button', { name: 'Check correction' }));

    await screen.findByText('Trap cleared');
    expect(screen.queryByText(/Explanation:/)).not.toBeInTheDocument();
  });
});

describe('hints', () => {
  it('renders no hint control at all when the question has no hint source', async () => {
    vi.mocked(trapHunterService.getTrapHunter).mockResolvedValue(
      response([trap({ hintsAvailable: 0 })]),
    );
    renderStage();

    await screen.findByText('She ___ to work every day.');
    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();
  });

  it('unlocks one level at a time and shows the ruled-out options as plain text', async () => {
    const user = userEvent.setup();
    vi.mocked(trapHunterService.getTrapHunter).mockResolvedValue(response([trap()]));
    vi.mocked(trapHunterService.requestTrapHint).mockResolvedValue({
      questionId: 't1',
      hintLevel: 1,
      hintsAvailable: 2,
      hints: [
        { level: 1, kind: 'narrow', payload: { shape: 'eliminate', optionIds: ['c', 'd'] } },
      ],
    });
    renderStage();

    await user.click(await screen.findByRole('button', { name: 'Show a hint' }));
    // Plain text, so a screen-reader user gets the hint without depending on
    // the strikethrough applied to the options themselves.
    expect(await screen.findByText(/going, gone/)).toBeInTheDocument();
    expect(trapHunterService.requestTrapHint).toHaveBeenCalledWith('l-1', {
      questionId: 't1',
      level: 1,
    });
  });

  it('nudges after 2 misses but STILL requires a click — it never opens itself', async () => {
    vi.mocked(trapHunterService.getTrapHunter).mockResolvedValue(
      response([trap({ attempts: 2 })]),
    );
    renderStage();

    // The label changes to the nudge...
    expect(await screen.findByRole('button', { name: 'Need a hint?' })).toBeInTheDocument();
    // ...but nothing has been revealed, and no request was made on the
    // student's behalf.
    expect(trapHunterService.requestTrapHint).not.toHaveBeenCalled();
    expect(screen.queryByText(/Explanation:/)).not.toBeInTheDocument();
  });

  it('does not escalate the incorrect sound as a student keeps missing', async () => {
    const user = userEvent.setup();
    vi.mocked(trapHunterService.getTrapHunter).mockResolvedValue(
      response([trap({ attempts: 4 })]),
    );
    vi.mocked(trapHunterService.answerTrap).mockResolvedValue(
      answer({ isCorrect: false, attempts: 5, clearedCount: 0, allCleared: false }),
    );
    renderStage();

    await user.click(await screen.findByRole('radio', { name: /^go$/ }));
    await user.click(screen.getByRole('button', { name: 'Check correction' }));
    await screen.findByText('Not yet — this one comes back');
    // Exactly once, exactly the same call as the first miss.
    expect(feedbackSounds.playIncorrect).toHaveBeenCalledTimes(1);
  });

  it('a hinted correction clears the trap exactly like an unaided one', async () => {
    const user = userEvent.setup();
    // A trap where every hint has already been taken.
    vi.mocked(trapHunterService.getTrapHunter).mockResolvedValue(
      response([
        trap({
          hintLevel: 2,
          hints: [
            { level: 1, kind: 'narrow', payload: { shape: 'eliminate', optionIds: ['c', 'd'] } },
            {
              level: 2,
              kind: 'explanation',
              payload: { shape: 'explanation', text: 'Third person singular takes -s.' },
            },
          ],
        }),
      ]),
    );
    vi.mocked(trapHunterService.answerTrap).mockResolvedValue(answer());
    renderStage();

    await user.click(await screen.findByRole('radio', { name: /goes/ }));
    await user.click(screen.getByRole('button', { name: 'Check correction' }));

    expect(await screen.findByText('Trap cleared')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Finish/ }));
    // Completed, with nothing anywhere marking the clear as assisted.
    expect(await screen.findByText('Every trap cleared')).toBeInTheDocument();
  });
});

describe('accessibility', () => {
  it('is fully operable from the keyboard', async () => {
    const user = userEvent.setup();
    vi.mocked(trapHunterService.getTrapHunter).mockResolvedValue(response([trap()]));
    vi.mocked(trapHunterService.answerTrap).mockResolvedValue(answer());
    renderStage();

    await screen.findByText('She ___ to work every day.');

    // Digit keys pick an option directly (the exam-software convention the
    // quiz inputs already implement — reused here, not reimplemented).
    const group = screen.getByRole('radiogroup');
    await user.click(within(group).getByRole('radio', { name: /^go$/ }));
    await user.keyboard('2');
    expect(within(group).getByRole('radio', { name: /goes/ })).toBeChecked();

    // Enter is "the obvious next thing": check, then advance.
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Trap cleared')).toBeInTheDocument();
  });

  it('exposes real progress on a progressbar, not just a coloured strip', async () => {
    vi.mocked(trapHunterService.getTrapHunter).mockResolvedValue(
      response([trap({ questionId: 't1' }), trap({ questionId: 't2' })]),
    );
    renderStage();

    const bar = await screen.findByRole('progressbar', { name: 'Trap Hunter progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '2');
  });
});

describe('refresh and resume', () => {
  it('rebuilds the queue from the server, keeping cleared traps out of it', async () => {
    vi.mocked(trapHunterService.getTrapHunter).mockResolvedValue(
      response(
        [
          trap({
            questionId: 't1',
            content: 'Already corrected.',
            cleared: {
              clearedAt: '2026-07-29T00:00:00.000Z',
              correctAnswer: { optionId: 'b' },
              explanation: null,
            },
          }),
          trap({ questionId: 't2', content: 'Still open.' }),
        ],
        { cleared: 1 },
      ),
    );
    renderStage();

    // The open one is on screen; the corrected one does not come back.
    expect(await screen.findByText('Still open.')).toBeInTheDocument();
    expect(screen.queryByText('Already corrected.')).not.toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('shows the all-clear when the server says every trap is cleared', async () => {
    vi.mocked(trapHunterService.getTrapHunter).mockResolvedValue(
      response(
        [
          trap({
            questionId: 't1',
            cleared: {
              clearedAt: '2026-07-29T00:00:00.000Z',
              correctAnswer: { optionId: 'b' },
              explanation: null,
            },
          }),
        ],
        { cleared: 1, completed: true },
      ),
    );
    renderStage();

    expect(await screen.findByText('Every trap cleared')).toBeInTheDocument();
  });
});

// Sprint 10 QA — the way ON from the all-clear panel.
//
// Before this, finishing the correction round produced a title, a body and a
// count with no action at all. The next stage of the SAME lesson is Advanced
// Practice, and clearing every trap is literally what removes one of its two
// prerequisites — but the student had to scroll back up to the stage stepper
// to discover that. NextLessonCard below the stage does not help: it goes to
// the next LESSON.
describe('the all-clear CTA', () => {
  const allCleared = () =>
    response(
      [
        trap({
          questionId: 't1',
          cleared: {
            clearedAt: '2026-07-29T00:00:00.000Z',
            correctAnswer: { optionId: 'b' },
            explanation: null,
          },
        }),
      ],
      { cleared: 1, completed: true },
    );

  it('offers Advanced Practice once every trap is cleared', async () => {
    vi.mocked(trapHunterService.getTrapHunter).mockResolvedValue(allCleared());
    const onGoToPractice = vi.fn();
    renderStage(undefined, { onGoToPractice });

    const cta = await screen.findByRole('button', {
      name: /Continue: Advanced Practice/i,
    });
    await userEvent.click(cta);

    expect(onGoToPractice).toHaveBeenCalledTimes(1);
  });

  it('offers NOTHING when the lesson has no practice task', async () => {
    // LessonPage omits the handler when the practice stage is 'unavailable',
    // because ?stage=practice would redirect straight back to the video — a
    // CTA that bounces the student is worse than no CTA.
    vi.mocked(trapHunterService.getTrapHunter).mockResolvedValue(allCleared());
    renderStage();

    expect(await screen.findByText('Every trap cleared')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not appear on the perfect-quiz panel', async () => {
    // 'No traps to hunt' is a different state and is deliberately left alone
    // in this pass.
    vi.mocked(trapHunterService.getTrapHunter).mockResolvedValue(
      response([], { hasSource: true, total: 0 }),
    );
    renderStage(undefined, { onGoToPractice: vi.fn() });

    expect(await screen.findByText('No traps to hunt')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Advanced Practice/i }),
    ).not.toBeInTheDocument();
  });

  it('still shows "Go to the quiz" — and only that — on the blocked panel', async () => {
    // The two CTAs share one button now. This is what catches them being
    // swapped by that refactor.
    vi.mocked(trapHunterService.getTrapHunter).mockResolvedValue(
      response([], { hasSource: false, total: 0 }),
    );
    const onGoToQuiz = vi.fn();
    renderStage(undefined, { onGoToQuiz, onGoToPractice: vi.fn() });

    expect(await screen.findByText('Finish the quiz first')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Go to the quiz/i }));
    expect(onGoToQuiz).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('button', { name: /Advanced Practice/i }),
    ).not.toBeInTheDocument();
  });
});
