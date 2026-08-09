import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import ModeSelectorBar from './ModeSelectorBar';

afterEach(() => cleanup());

const renderBar = (activeMode: Parameters<typeof ModeSelectorBar>[0]['activeMode'] = 'flashcard') =>
  render(
    <LanguageProvider>
      <ModeSelectorBar activeMode={activeMode} onSelect={vi.fn()} />
    </LanguageProvider>,
  );

describe('ModeSelectorBar', () => {
  it('renders all 5 tabs in order: Flashcard, Guess the Word, Games, Fill in the Blank, Dictation', () => {
    renderBar();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      expect.stringContaining('Flashcards'),
      expect.stringContaining('Guess the Word'),
      expect.stringContaining('Games'),
      expect.stringContaining('Fill in the Blank'),
      expect.stringContaining('Dictation'),
    ]);
  });

  it('the Fill in the Blank tab is no longer disabled and shows no "Soon" badge', () => {
    renderBar();
    const fillInTheBlank = screen.getByRole('tab', { name: /fill in the blank/i });
    expect(fillInTheBlank).not.toBeDisabled();
    expect(screen.queryByText('Soon')).not.toBeInTheDocument();
  });

  it('marks the active mode as selected', () => {
    renderBar('guess');
    expect(screen.getByRole('tab', { name: /guess the word/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /flashcards/i })).toHaveAttribute('aria-selected', 'false');
  });
});
