import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import StartMethodStep from './StartMethodStep';

afterEach(cleanup);

const renderStep = () => {
  const onBack = vi.fn();
  const onBeginnerStarted = vi.fn();
  const onPlacementStarted = vi.fn();
  render(
    <LanguageProvider>
      <MemoryRouter>
        <StartMethodStep
          onBack={onBack}
          onBeginnerStarted={onBeginnerStarted}
          onPlacementStarted={onPlacementStarted}
        />
      </MemoryRouter>
    </LanguageProvider>,
  );
  return { onBack, onBeginnerStarted, onPlacementStarted };
};

describe('StartMethodStep — wizard-level Back button', () => {
  it('calls onBack when clicked', async () => {
    const user = userEvent.setup();
    const { onBack } = renderStep();

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
