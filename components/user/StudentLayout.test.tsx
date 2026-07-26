import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { ThemeProvider } from '../../theme/ThemeProvider';
import StudentLayout from './StudentLayout';

// Sprint 05 removed the header search box. It had exactly one consumer (the
// Dashboard), where it filtered that page's own small client-side course
// grid; the three module entry points replaced it. These tests guard the two
// halves of that change: the input is gone, and nothing else in the header
// regressed with it.
const renderLayout = () =>
  render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={['/home']}>
          <StudentLayout>
            <p>PAGE_CONTENT</p>
          </StudentLayout>
        </MemoryRouter>
      </LanguageProvider>
    </ThemeProvider>,
  );

beforeEach(() => localStorage.clear());

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('StudentLayout header (Sprint 05)', () => {
  it('renders no search input', () => {
    renderLayout();

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
  });

  it('renders no search toggle button', () => {
    renderLayout();

    expect(screen.queryByRole('button', { name: /search/i })).not.toBeInTheDocument();
  });

  it('still renders the theme, language and notification controls', () => {
    renderLayout();

    // Both the desktop header and the mobile header render the cluster, so
    // each control appears twice — presence is what matters here.
    expect(screen.getAllByRole('button', { name: /dark mode|light mode/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /language/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /notification/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /user menu/i }).length).toBeGreaterThan(0);
  });

  it('still renders page content and the navigation shell', () => {
    renderLayout();

    expect(screen.getByText('PAGE_CONTENT')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /grammar/i }).length).toBeGreaterThan(0);
  });
});
