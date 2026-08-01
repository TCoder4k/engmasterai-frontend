import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { useTranslation } from '../../i18n/useTranslation';
import BackButton from './BackButton';

// Sprint 10 QA — the shared back control.
//
// Small enough that the temptation is to test nothing. The three things worth
// pinning are the ones the six copy-pasted versions each got wrong somewhere:
// it must be a real LINK to a real route (not a history-back button), it must
// keep the 44px touch target, and its label must come from i18n rather than
// being baked in.

afterEach(() => cleanup());

const renderButton = (props: Partial<React.ComponentProps<typeof BackButton>> = {}) =>
  render(
    <LanguageProvider>
      <MemoryRouter initialEntries={['/courses/c-1/lessons/l-9']}>
        <BackButton to="/courses/c-1" label="Back to course details" {...props} />
      </MemoryRouter>
    </LanguageProvider>,
  );

describe('BackButton', () => {
  it('renders a link to the given route, labelled by the caller', () => {
    renderButton();

    const link = screen.getByRole('link', { name: 'Back to course details' });
    expect(link).toHaveAttribute('href', '/courses/c-1');
  });

  it('is a LINK, not a button', () => {
    // Not `navigate(-1)`. History-back lands wherever the student came from,
    // which for a lesson opened from a bookmark is not the course page the
    // label promises.
    renderButton();

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('keeps the arrow decorative and the touch target at 44px', () => {
    renderButton();

    const link = screen.getByRole('link');
    // The icon must not join the accessible name — "arrow left Back to course
    // details" is noise to a screen reader.
    expect(link).toHaveAccessibleName('Back to course details');
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(link.className).toMatch(/min-h-\[44px\]/);
  });

  it('keeps a visible focus ring', () => {
    renderButton();

    expect(screen.getByRole('link').className).toMatch(
      /focus-visible:ring-2/,
    );
  });

  it('accepts a spacing className without losing its own styling', () => {
    // The escape hatch exists because some parents drive the gap with
    // `space-y-*` and some need the margin here. It must not be able to
    // replace the pill itself.
    renderButton({ className: 'mb-8' });

    const link = screen.getByRole('link');
    expect(link.className).toMatch(/mb-8/);
    expect(link.className).toMatch(/rounded-full/);
  });

  it('carries router state through to the destination', async () => {
    // DeckDetailPage and WordDetailPage thread a breadcrumb this way.
    const Destination: React.FC = () => {
      const location = useLocation();
      return <p>state: {JSON.stringify(location.state)}</p>;
    };

    render(
      <LanguageProvider>
        <MemoryRouter initialEntries={['/vocab/words/w-1']}>
          <Routes>
            <Route
              path="/vocab/words/w-1"
              element={
                <BackButton
                  to="/vocab/decks/d-1"
                  label="Back to deck"
                  state={{ deckId: 'd-1' }}
                />
              }
            />
            <Route path="/vocab/decks/d-1" element={<Destination />} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>,
    );

    await userEvent.click(screen.getByRole('link'));
    expect(screen.getByText(/state:/)).toHaveTextContent('"deckId":"d-1"');
  });

  it('renders the Vietnamese label when the caller passes one', () => {
    // The component holds no copy of its own; this proves the label really is
    // the caller's translated string rather than anything baked in.
    localStorage.setItem('language', 'vi');
    try {
      const ViCaller: React.FC = () => {
        const { t } = useTranslation();
        return <BackButton to="/courses/c-1" label={t.lesson.backToCourse} />;
      };

      render(
        <LanguageProvider>
          <MemoryRouter>
            <ViCaller />
          </MemoryRouter>
        </LanguageProvider>,
      );

      expect(
        screen.getByRole('link', { name: 'Quay lại Trang Chi Tiết Khóa Học' }),
      ).toBeInTheDocument();
    } finally {
      localStorage.removeItem('language');
    }
  });
});
