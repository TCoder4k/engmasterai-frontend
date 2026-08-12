import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import PlacementTestStep from './PlacementTestStep';
import { PlacementAttemptState, PlacementResult } from '../../services/placementService';
import * as tts from '../../services/tts';

vi.mock('../../services/placementService', async () => {
  const actual =
    await vi.importActual<typeof import('../../services/placementService')>(
      '../../services/placementService',
    );
  return {
    ...actual,
    answerPlacementQuestion: vi.fn().mockResolvedValue({ questionId: 'q1', recorded: true }),
    submitPlacementAttempt: vi.fn(),
  };
});

import { answerPlacementQuestion, submitPlacementAttempt } from '../../services/placementService';

const mockAnswer = vi.mocked(answerPlacementQuestion);
const mockSubmit = vi.mocked(submitPlacementAttempt);

const attempt: PlacementAttemptState = {
  attemptId: 'attempt-1',
  goal: 'TOEIC_450',
  startedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 90_000).toISOString(), // 1:30 remaining
  questions: [
    {
      id: 'q1',
      section: 'LISTENING',
      type: 'MULTIPLE_CHOICE',
      difficulty: 'EASY',
      content: 'What did the speaker ask for?',
      options: [
        { id: 'a', text: 'Tea with sugar' },
        { id: 'b', text: 'Coffee without sugar' },
      ],
      audioUrl: 'https://example.com/q1.mp3',
      transcript: null,
      imageUrl: null,
    },
    {
      id: 'q2',
      section: 'GRAMMAR',
      type: 'MULTIPLE_CHOICE',
      difficulty: 'EASY',
      content: 'Choose the correct form.',
      options: [
        { id: 'a', text: 'go' },
        { id: 'b', text: 'goes' },
      ],
      audioUrl: null,
      transcript: null,
      imageUrl: null,
    },
  ],
  answers: [],
};

const result: PlacementResult = {
  attemptId: 'attempt-1',
  grammarScore: 100,
  vocabularyScore: 0,
  listeningScore: 100,
  overallScore: 67,
  estimatedLevel: 'A2',
  durationSeconds: 120,
  completedAt: new Date().toISOString(),
};

const renderStep = (onCompleted = vi.fn(), onBack = vi.fn()) =>
  render(
    // Reduced motion, matching how the real app runs under test (App.tsx's
    // own MotionConfig, driven by vitest.setup.ts's prefers-reduced-motion
    // mock) — without it framer-motion's real SlideLeft exit transition
    // leaves the outgoing question's card mounted mid-animation, which is
    // not what any test here is trying to exercise.
    <MotionConfig reducedMotion="always">
      <LanguageProvider>
        <MemoryRouter>
          <PlacementTestStep attempt={attempt} onCompleted={onCompleted} onBack={onBack} />
        </MemoryRouter>
      </LanguageProvider>
    </MotionConfig>,
  );

describe('PlacementTestStep', () => {
  beforeEach(() => {
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    // jsdom has no real speechSynthesis — stubbed so a Listening question
    // with only a transcript (no audioUrl yet) exercises the same TTS-mode
    // branch it would hit in a real browser, rather than falling through to
    // the "unsupported" message.
    vi.spyOn(tts, 'isTtsSupported').mockReturnValue(true);
    vi.spyOn(tts, 'speakText').mockReturnValue(true);
    vi.spyOn(tts, 'cancelSpeech').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('renders the section header, timer and progress label for the first (listening) question', () => {
    renderStep();
    expect(screen.getByText('Listening')).toBeInTheDocument();
    expect(screen.getByText('Listen and choose the correct answer')).toBeInTheDocument();
    expect(screen.getByText('1/2 questions')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('1:30');
  });

  it('the wizard-level Back button persists the currently selected answer, then calls onBack — leaving the in-progress attempt untouched for later resume', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    renderStep(vi.fn(), onBack);

    await user.click(screen.getByRole('radio', { name: /Tea with sugar/i }));
    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(mockAnswer).toHaveBeenCalledWith('attempt-1', 'q1', { optionId: 'a' });
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('renders the custom audio player (not the bare native <audio controls>) for a listening question', () => {
    const { container } = renderStep();
    expect(screen.getByTestId('placement-audio-element')).toBeInTheDocument();
    expect(container.querySelector('audio[controls]')).not.toBeInTheDocument();
  });

  // Regression: a Listening question with no real recording yet (audioUrl
  // null) must still show the custom player, driven by TTS off its
  // transcript — never fall through to plain text with the full dialogue
  // printed on screen (what a missing audioUrl used to silently produce).
  it('renders the TTS-driven player — not raw dialogue text — for a listening question with only a transcript', () => {
    const transcriptOnlyAttempt: PlacementAttemptState = {
      ...attempt,
      questions: [
        {
          id: 'q1',
          section: 'LISTENING',
          type: 'MULTIPLE_CHOICE',
          difficulty: 'EASY',
          content: 'Where is the bus stop?',
          options: [
            { id: 'a', text: 'Next to the bakery' },
            { id: 'b', text: 'Inside the bakery' },
          ],
          audioUrl: null,
          transcript:
            'A: "Excuse me, where is the nearest bus stop?" B: "It\'s just around the corner, next to the bakery."',
          imageUrl: null,
        },
        attempt.questions[1],
      ],
    };

    render(
      <MotionConfig reducedMotion="always">
        <LanguageProvider>
          <MemoryRouter>
            <PlacementTestStep attempt={transcriptOnlyAttempt} onCompleted={vi.fn()} onBack={vi.fn()} />
          </MemoryRouter>
        </LanguageProvider>
      </MotionConfig>,
    );

    expect(screen.getByText('Where is the bus stop?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.queryByTestId('placement-audio-element')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Excuse me, where is the nearest bus stop/i),
    ).not.toBeInTheDocument();
  });

  it("pauses the listening question's audio and unmounts it once the student moves to the next question", async () => {
    const user = userEvent.setup();
    renderStep();

    await user.click(screen.getByRole('radio', { name: /Tea with sugar/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));

    // The section header switches immediately (it's not inside the animated
    // SlideLeft region), but the question card itself only remounts once the
    // outgoing card's exit transition finishes — wait for q2's own content
    // (findBy* retries) rather than the header, or this assertion can run
    // while q1's card (and its audio) is still mid-exit.
    expect(await screen.findByText('Choose the correct form.')).toBeInTheDocument();
    expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    // q2 (Grammar) has no audioUrl, so no audio player should exist at all —
    // the previous question's player is gone, not merely paused-and-kept.
    expect(screen.queryByTestId('placement-audio-element')).not.toBeInTheDocument();
    expect(mockAnswer).toHaveBeenCalledWith('attempt-1', 'q1', { optionId: 'a' });
  });

  it('submits and calls onCompleted once the last question is answered and Submit is clicked', async () => {
    mockSubmit.mockResolvedValueOnce(result);
    const onCompleted = vi.fn();
    const user = userEvent.setup();
    renderStep(onCompleted);

    await user.click(screen.getByRole('radio', { name: /Tea with sugar/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(await screen.findByText('Choose the correct form.')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /^go$/i }));
    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => expect(mockSubmit).toHaveBeenCalledWith('attempt-1'));
    await waitFor(() => expect(onCompleted).toHaveBeenCalledWith(result));
  });
});
