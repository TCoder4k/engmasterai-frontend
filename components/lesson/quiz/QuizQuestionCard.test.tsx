import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import QuizQuestionCard from './QuizQuestionCard';
import { StudentQuizQuestion, SubmittedAnswer } from '../../../services/quizService';

afterEach(cleanup);

const baseQuestion: StudentQuizQuestion = {
  id: 'q1',
  type: 'MULTIPLE_CHOICE',
  difficulty: null,
  content: 'What did the speaker ask for?',
  options: [
    { id: 'a', text: 'Tea with sugar' },
    { id: 'b', text: 'Tea without sugar' },
  ],
  audioUrl: null,
  imageUrl: null,
  orderIndex: 0,
  answered: null,
};

const renderCard = (props: {
  question: StudentQuizQuestion;
  variant?: 'default' | 'placement';
  renderAudio?: (audio: { audioUrl: string | null; transcript: string | null }) => ReactNode;
  value?: SubmittedAnswer | null;
}) =>
  render(
    <LanguageProvider>
      <QuizQuestionCard
        question={props.question}
        index={0}
        total={1}
        value={props.value ?? null}
        onChange={vi.fn()}
        onEnter={vi.fn()}
        variant={props.variant}
        renderAudio={props.renderAudio}
      />
    </LanguageProvider>,
  );

// New in the onboarding placement redesign: `renderAudio` lets a caller
// swap in its own audio UI without QuizQuestionCard (a shared component used
// by every lesson quiz) importing anything feature-specific, and `variant`
// is additive-only and passed straight through to MultipleChoiceInput.
describe('QuizQuestionCard — renderAudio and variant', () => {
  it('falls back to the native <audio> element when renderAudio is not passed', () => {
    const { container } = renderCard({
      question: { ...baseQuestion, audioUrl: 'https://example.com/clip.mp3' },
    });
    expect(container.querySelector('audio')).toBeInTheDocument();
  });

  it('renders via renderAudio instead of the native element when provided', () => {
    const renderAudio = vi.fn(({ audioUrl }: { audioUrl: string | null; transcript: string | null }) => (
      <div data-testid="custom-audio">{audioUrl}</div>
    ));
    const { container } = renderCard({
      question: { ...baseQuestion, audioUrl: 'https://example.com/clip.mp3' },
      renderAudio,
    });
    expect(renderAudio).toHaveBeenCalledWith({ audioUrl: 'https://example.com/clip.mp3', transcript: null });
    expect(screen.getByTestId('custom-audio')).toHaveTextContent('https://example.com/clip.mp3');
    expect(container.querySelector('audio')).not.toBeInTheDocument();
  });

  it('calls renderAudio when the question has a transcript but no audioUrl — the placement no-recording-yet case', () => {
    const renderAudio = vi.fn(() => <div data-testid="custom-audio">tts</div>);
    renderCard({
      question: { ...baseQuestion, audioUrl: null, transcript: 'A: "Hi." B: "Hello."' },
      renderAudio,
    });
    expect(renderAudio).toHaveBeenCalledWith({ audioUrl: null, transcript: 'A: "Hi." B: "Hello."' });
    expect(screen.getByTestId('custom-audio')).toBeInTheDocument();
  });

  it('never calls renderAudio when the question has neither audioUrl nor transcript', () => {
    const renderAudio = vi.fn();
    renderCard({ question: baseQuestion, renderAudio });
    expect(renderAudio).not.toHaveBeenCalled();
  });

  it('passes variant="placement" through to option rendering (lettered badges)', () => {
    renderCard({ question: baseQuestion, variant: 'placement' });
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('defaults to numbered badges when variant is omitted — no behavior change for existing callers', () => {
    renderCard({ question: baseQuestion });
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
