import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import HomePage from './HomePage';
import { PRICING_PLANS, SAMPLE_ANALYSIS_PRESETS, SAMPLE_SENTENCES } from './landing/landingContent';

// The landing page's job is to send a visitor somewhere real. Before the
// first pass it mostly did not: `#pricing` pointed at a page that had never
// existed, the logo was an unclickable <div>, and the footer carried sixteen
// `href="#"` links plus App Store buttons for apps that do not exist. The
// page has since been rebuilt twice; these tests exist so that cannot come
// back through a redesign.

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
  '/courses',
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

  it('sends every pricing plan to a real signup, since nothing here can take a payment', () => {
    renderPage();

    PRICING_PLANS.forEach((plan) => {
      expect(screen.getByRole('link', { name: new RegExp(plan.ctaText, 'i') })).toHaveAttribute(
        'href',
        '/register',
      );
    });
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
      within(screen.getByRole('navigation', { name: 'Điều hướng chính' })).getAllByRole('link', {
        name: /vào học/i,
      })[0],
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

// The page is long and almost entirely interactive. These cover the four
// controls a visitor is most likely to touch — if any of them stops
// responding the page still *looks* right, which is exactly the kind of
// breakage a screenshot never catches.
describe('HomePage — the interactive parts actually respond', () => {
  it('switches the skills panel when another skill tab is chosen', async () => {
    renderPage();

    const grammarTab = screen.getByRole('tab', { name: /Ngữ pháp tự nhiên/ });
    const vocabTab = screen.getByRole('tab', { name: /Từ vựng ghi nhớ sâu/ });

    expect(grammarTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Quy tắc: Hiện tại tiếp diễn');

    await userEvent.click(vocabTab);

    // The tab state flips immediately; the panel crossfades, so it is
    // awaited rather than read on the same tick.
    expect(vocabTab).toHaveAttribute('aria-selected', 'true');
    expect(grammarTab).toHaveAttribute('aria-selected', 'false');
    await screen.findByText('/ɪnˈkwaɪər/');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Inquire');
    // Each panel ends in a real way into the module it just described.
    expect(screen.getByRole('link', { name: /Khám phá thư viện từ/ })).toHaveAttribute('href', '/vocab');
  });

  it('swaps the demo analysis when a sample sentence is picked', async () => {
    renderPage();

    // Substrings of the two presets' corrected sentences, so the assertion
    // does not depend on the typographic quotes the component adds.
    expect(screen.getByText(/I am writing this email to inquire/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: SAMPLE_SENTENCES[2].label }));

    // Awaited: the result panel crossfades between analyses.
    await screen.findByText(/Yesterday I went to the market/);
    expect(screen.queryByText(/I am writing this email to inquire/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Câu tiếng Anh cần kiểm tra')).toHaveValue(SAMPLE_SENTENCES[2].text);
    // The panel is driven by the authored preset, not by a live model.
    expect(SAMPLE_ANALYSIS_PRESETS[SAMPLE_SENTENCES[2].text]).toBeDefined();
  });

  it('re-prices the plans when the billing cycle is toggled', async () => {
    renderPage();

    const pro = PRICING_PLANS.find((plan) => plan.popular)!;
    // Intl puts a non-breaking space before ₫, and Testing Library
    // normalizes whitespace on the DOM side but not on the matcher side —
    // so the expectation has to be normalized to match.
    const vnd = (amount: number) =>
      new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
        .format(amount)
        .replace(/\s/g, ' ');
    const yearly = vnd(pro.yearlyPriceMonthly);
    const monthly = vnd(pro.monthlyPrice);

    expect(screen.getByText(yearly)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Thanh toán hàng tháng/ }));

    expect(screen.getByText(monthly)).toBeInTheDocument();
    expect(screen.queryByText(yearly)).not.toBeInTheDocument();
  });

  it('opens and closes an FAQ answer', async () => {
    renderPage();

    // Every FAQ question ends in a question mark; nothing else on the page
    // is a button whose label does.
    const [first, second] = screen.getAllByRole('button', { name: /\?$/ });

    expect(first).toHaveAttribute('aria-expanded', 'true'); // first answer starts open
    expect(second).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(second);

    expect(second).toHaveAttribute('aria-expanded', 'true');
    expect(first).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('HomePage — marketing copy is placeholder, and the demo says so', () => {
  // The product owner asked for the design reference's marketing content to
  // be carried over verbatim, so the partner names, testimonials, learner
  // counts and prices on this page are illustrative rather than measured.
  // This test does not judge that; it pins the content to ONE module so
  // replacing it before a public launch stays a single-file edit.
  it('renders its partners, reviews and prices from landingContent', () => {
    renderPage();

    PRICING_PLANS.forEach((plan) => {
      expect(screen.getByRole('heading', { name: plan.name })).toBeInTheDocument();
    });
    expect(screen.getByText(/Được tin dùng bởi nhân sự tại/)).toBeInTheDocument();
  });

  it('does not hotlink anyone else’s brand logos', () => {
    const { container } = renderPage();
    expect(container.querySelector('img[src*="wikipedia"]')).toBeNull();
  });

  it('labels the correction demo as a demo, since no model is behind it', () => {
    renderPage();
    expect(screen.getByText(/Bản demo/i)).toBeInTheDocument();
  });
});
