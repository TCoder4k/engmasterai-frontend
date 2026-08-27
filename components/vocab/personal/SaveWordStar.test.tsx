import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import SaveWordStar from './SaveWordStar';

const renderStar = (props: Partial<React.ComponentProps<typeof SaveWordStar>> = {}) =>
  render(
    <LanguageProvider>
      <SaveWordStar isSaved={false} onToggle={vi.fn()} {...props} />
    </LanguageProvider>,
  );

afterEach(() => cleanup());

describe('SaveWordStar', () => {
  it('renders as an outline star with a "save" label when not saved', () => {
    renderStar({ isSaved: false });

    const button = screen.getByRole('button', { name: 'Save to My Vocabulary' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders as a filled star with a "remove" label when saved', () => {
    renderStar({ isSaved: true });

    const button = screen.getByRole('button', { name: 'Remove from My Vocabulary' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button.querySelector('svg')).toHaveAttribute('fill', 'currentColor');
  });

  it('calls onToggle when clicked', async () => {
    const onToggle = vi.fn();
    renderStar({ isSaved: false, onToggle });

    await userEvent.click(screen.getByRole('button'));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('is disabled while busy and does not call onToggle', async () => {
    const onToggle = vi.fn();
    renderStar({ isSaved: false, onToggle, isBusy: true });

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe('SaveWordStar — as="span" (nested inside another interactive element)', () => {
  it('renders a role="button" span, not a real <button> (avoids invalid nested-button markup)', () => {
    renderStar({ isSaved: false, as: 'span' });

    const el = screen.getByRole('button');
    expect(el.tagName).toBe('SPAN');
  });

  it('calls onToggle on click and stops the click from reaching a parent handler', async () => {
    const onToggle = vi.fn();
    const parentClick = vi.fn();
    render(
      <LanguageProvider>
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
        <div onClick={parentClick}>
          <SaveWordStar isSaved={false} onToggle={onToggle} as="span" />
        </div>
      </LanguageProvider>,
    );

    await userEvent.click(screen.getByRole('button'));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('calls onToggle on Enter and Space', async () => {
    const onToggle = vi.fn();
    renderStar({ isSaved: false, onToggle, as: 'span' });

    const el = screen.getByRole('button');
    el.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');

    expect(onToggle).toHaveBeenCalledTimes(2);
  });
});
