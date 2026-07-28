import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import HomePage from './HomePage';

// The landing page's job is to send a visitor somewhere real. Before this
// pass it mostly did not: `#pricing` pointed at a page that has never
// existed, the logo was an unclickable <div>, and the footer carried
// sixteen `href="#"` links plus App Store buttons for apps that do not
// exist. These tests exist so that cannot come back.

const renderPage = () =>
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );

// Every route the landing page may link to must be a real route in App.tsx.
const REAL_ROUTES = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/grammar',
  '/vocab',
  '/practice/listening',
  '/practice/review',
  '/home',
  '/admin',
];

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('HomePage — every link goes somewhere real', () => {
  it('has no dead links anywhere on the page', () => {
    const { container } = renderPage();

    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '');
    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs).not.toContain('#');
    expect(hrefs).not.toContain('');
  });

  it('points every internal link at a route that exists', () => {
    const { container } = renderPage();

    const internal = Array.from(container.querySelectorAll('a'))
      .map((a) => a.getAttribute('href') ?? '')
      .filter((href) => href.startsWith('/'));

    expect(internal.length).toBeGreaterThan(0);
    internal.forEach((href) => expect(REAL_ROUTES).toContain(href));
  });

  it('resolves every in-page anchor to a section that is actually rendered', () => {
    const { container } = renderPage();

    const anchors = Array.from(container.querySelectorAll('a'))
      .map((a) => a.getAttribute('href') ?? '')
      .filter((href) => href.startsWith('#'));

    expect(anchors.length).toBeGreaterThan(0);
    anchors.forEach((href) => {
      expect(container.querySelector(`#${href.slice(1)}`)).not.toBeNull();
    });
  });

  it('makes the logo a link home', () => {
    renderPage();
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    expect(within(nav).getByRole('link', { name: /trang chủ/i })).toHaveAttribute('href', '/');
  });
});

describe('HomePage — the header follows the session', () => {
  it('offers sign-in and sign-up to a visitor', () => {
    renderPage();
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });

    expect(within(nav).getAllByRole('link', { name: 'Đăng nhập' })[0]).toHaveAttribute('href', '/login');
    expect(within(nav).getAllByRole('link', { name: /tạo tài khoản/i })[0]).toHaveAttribute(
      'href',
      '/register',
    );
    expect(within(nav).queryByRole('link', { name: /vào học/i })).not.toBeInTheDocument();
  });

  it('sends a signed-in student straight into the app instead of asking them to sign in again', () => {
    localStorage.setItem(
      'user',
      JSON.stringify({ id: 'u-1', name: 'Tu', email: 't@example.com', role: 'USER' }),
    );
    renderPage();
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });

    expect(within(nav).getAllByRole('link', { name: /vào học/i })[0]).toHaveAttribute('href', '/home');
    expect(within(nav).queryByRole('link', { name: 'Đăng nhập' })).not.toBeInTheDocument();
  });

  it('sends a signed-in admin to the admin area', () => {
    localStorage.setItem(
      'user',
      JSON.stringify({ id: 'a-1', name: 'Admin', email: 'a@example.com', role: 'ADMIN' }),
    );
    renderPage();

    expect(
      within(screen.getByRole('navigation', { name: 'Điều hướng chính' })).getAllByRole('link', { name: /vào học/i })[0],
    ).toHaveAttribute('href', '/admin');
  });

  it('opens and closes the mobile menu', async () => {
    renderPage();

    const toggle = screen.getByRole('button', { name: 'Mở menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(toggle);

    expect(screen.getByRole('button', { name: 'Đóng menu' })).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('HomePage — nothing fabricated', () => {
  it('claims no learner counts, ratings or partner brands', () => {
    const { container } = renderPage();
    const text = container.textContent ?? '';

    // The removed "social proof" band claimed 10,000+ learners and showed
    // Google/Facebook/YouTube/Slack logos as partners.
    expect(text).not.toMatch(/10[.,]000/);
    expect(text).not.toMatch(/học viên đã tin dùng/i);
    expect(container.querySelector('img[src*="wikipedia"]')).toBeNull();
  });

  it('labels the correction demo as a demo, since no model is behind it', () => {
    const { container } = renderPage();
    expect(container.textContent).toMatch(/demo/i);
  });
});
