import React from 'react';

// The landing page's in-page navigation, declared once.
//
// Header, footer and hero all link into these sections, and HomePage's test
// asserts that every `#anchor` on the page resolves to an element that is
// actually rendered — so adding a link here without rendering the section
// fails the suite rather than shipping a nav item that goes nowhere.
export const SECTION_IDS = {
  skills: 'skills',
  howItWorks: 'how-it-works',
  demo: 'demo',
  features: 'features',
  pricing: 'pricing',
  testimonials: 'testimonials',
  faq: 'faq',
} as const;

export const SECTION_LINKS = [
  { name: 'Khóa học', href: `#${SECTION_IDS.skills}` },
  { name: 'Cách hoạt động', href: `#${SECTION_IDS.howItWorks}` },
  { name: 'Thử AI trực tiếp', href: `#${SECTION_IDS.demo}` },
  { name: 'Tính năng', href: `#${SECTION_IDS.features}` },
  { name: 'Bảng giá', href: `#${SECTION_IDS.pricing}` },
  { name: 'Đánh giá', href: `#${SECTION_IDS.testimonials}` },
];

/**
 * Smooth-scrolls to an in-page section.
 *
 * Deliberately NOT `html { scroll-behavior: smooth }`: that is global, and
 * it would turn the lesson player's `window.scrollTo(0, 0)` stage reset into
 * an animated scroll on a page that has nothing to do with marketing.
 *
 * The href is left intact on the anchor, so the link still works with
 * JavaScript disabled and still passes the "every anchor resolves" test.
 * `scrollIntoView` is called optionally because jsdom does not implement it.
 */
export const scrollToSection =
  (href: string) =>
  (event: React.MouseEvent<HTMLAnchorElement>): void => {
    const target = document.getElementById(href.replace('#', ''));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };
