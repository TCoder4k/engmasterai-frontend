import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import MultipleChoiceInput from './MultipleChoiceInput';
import { QuizQuestionOption } from '../../../services/quizService';

afterEach(cleanup);

const options: QuizQuestionOption[] = [
  { id: 'a', text: 'Tea with sugar' },
  { id: 'b', text: 'Tea without sugar' },
  { id: 'c', text: 'Coffee with sugar' },
  { id: 'd', text: 'Coffee without sugar' },
];

// The `variant` prop is additive-only (Onboarding placement redesign): every
// existing caller (lesson quizzes, AdvancedPracticeStage, etc.) omits it and
// must keep getting today's numbered/violet look, unchanged. These tests
// pin both the default behavior and the new opt-in placement behavior so a
// future edit cannot blur the two together.
describe('MultipleChoiceInput — variant prop', () => {
  it('defaults to numbered (1/2/3/4) badges when no variant is passed', () => {
    render(<MultipleChoiceInput options={options} value={null} onChange={vi.fn()} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.queryByText('A')).not.toBeInTheDocument();
  });

  it('defaults to numbered badges under variant="default" too', () => {
    render(<MultipleChoiceInput options={options} value={null} onChange={vi.fn()} variant="default" />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders lettered (A/B/C/D) badges under variant="placement"', () => {
    render(<MultipleChoiceInput options={options} value={null} onChange={vi.fn()} variant="placement" />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('still fires onChange with the option id under variant="placement" — only the glyph/color changed', () => {
    const onChange = vi.fn();
    render(<MultipleChoiceInput options={options} value={null} onChange={onChange} variant="placement" />);

    fireEvent.click(screen.getByRole('radio', { name: /Coffee with sugar/i }));

    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('shows a checkmark instead of a letter once an option is selected under variant="placement"', () => {
    render(<MultipleChoiceInput options={options} value="b" onChange={vi.fn()} variant="placement" />);
    // The selected option's badge swaps to a check icon; its letter glyph is gone.
    const selected = screen.getByRole('radio', { name: /Tea without sugar/i });
    expect(selected).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText('B')).not.toBeInTheDocument();
  });
});
