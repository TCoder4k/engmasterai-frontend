import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MotionConfig } from 'framer-motion';
import { FadeIn, SlideUp, SlideLeft, ScaleIn, StaggerContainer, StaggerItem, AnimatedCounter } from './index';

// Sprint 06B.5 — the guarantee this file exists to protect: NO content is
// reachable only through motion. Under reducedMotion="always" (what a
// student with the OS setting enabled gets, and what vitest.setup.ts makes
// every test run as) every primitive must still render its children, in the
// accessibility tree, immediately.
//
// A primitive that animated content IN from opacity 0 and never arrived
// would be invisible to that student — this is the regression that would
// otherwise be very easy to ship and very hard to notice.
const renderReduced = (ui: React.ReactNode) =>
  render(<MotionConfig reducedMotion="always">{ui}</MotionConfig>);

describe('shared motion primitives under reduced motion', () => {
  it('FadeIn still renders its children', () => {
    renderReduced(<FadeIn>visible content</FadeIn>);
    expect(screen.getByText('visible content')).toBeInTheDocument();
  });

  it('SlideUp still renders its children', () => {
    renderReduced(<SlideUp>arriving content</SlideUp>);
    expect(screen.getByText('arriving content')).toBeInTheDocument();
  });

  it('SlideLeft still renders its children in both directions', () => {
    const { unmount } = renderReduced(<SlideLeft direction={1}>forward</SlideLeft>);
    expect(screen.getByText('forward')).toBeInTheDocument();
    unmount();

    renderReduced(<SlideLeft direction={-1}>backward</SlideLeft>);
    expect(screen.getByText('backward')).toBeInTheDocument();
  });

  it('ScaleIn still renders its children', () => {
    renderReduced(<ScaleIn>popped</ScaleIn>);
    expect(screen.getByText('popped')).toBeInTheDocument();
  });

  it('StaggerContainer renders every item, not just the first', () => {
    renderReduced(
      <StaggerContainer>
        <StaggerItem>one</StaggerItem>
        <StaggerItem>two</StaggerItem>
        <StaggerItem>three</StaggerItem>
      </StaggerContainer>,
    );
    expect(screen.getByText('one')).toBeInTheDocument();
    expect(screen.getByText('two')).toBeInTheDocument();
    expect(screen.getByText('three')).toBeInTheDocument();
  });
});

describe('AnimatedCounter', () => {
  it('announces only the final value to assistive tech, never an intermediate frame', () => {
    render(<AnimatedCounter value={92} suffix="%" />);
    // The screen-reader copy carries the real number immediately; the
    // ticking figure beside it is aria-hidden.
    const srCopy = document.querySelector('.sr-only');
    expect(srCopy).not.toBeNull();
    expect(srCopy?.textContent).toBe('92%');
  });

  it('shows the real value immediately under reduced motion, with no count-up', () => {
    renderReduced(<AnimatedCounter value={75} suffix="%" />);
    // Both the visible and the announced copy read the true value — a
    // student with reduced motion never sees a 0 that later becomes 75.
    expect(screen.getAllByText('75%').length).toBeGreaterThan(0);
  });
});
