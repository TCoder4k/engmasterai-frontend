import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import { parseGrammarNotes } from './parseGrammarNotes';
import GrammarTheoryCards from './GrammarTheoryCards';

// Sprint 06A — the theory stage renders one typed card per authored block.
//
// The headline rule under test: Grammar cards are PROGRESSIVE. A Foundation
// lesson carries concept / rule / formula / examples / tips and nothing else,
// and must show no trace that Signal Words, TOEIC Focus or Exam Trap exist —
// no label, no empty container, no reserved space.

const FOUNDATION_LESSON = `## Concept Summary
Present Simple is used for habits, routines, and general facts.

## Grammar Rule
Use the base form of the verb with I, You, We, They.

## Form and Structure
Affirmative: Subject + V / V-s/es

## Examples
I study English every day.
She works at a bank.

## Tips
Remember to add -s or -es after He, She, and It.

## Lesson Summary
Use Present Simple for routines, habits, and general truths.`;

const renderNotes = (notes: string) =>
  render(
    <LanguageProvider>
      <GrammarTheoryCards parsed={parseGrammarNotes(notes)} />
    </LanguageProvider>,
  );

// Cards are the DIRECT children of the grid. A nested list — the example
// sub-cards — is legitimately made of listitems too, so a role query would
// count those as cards.
const cards = () => Array.from(screen.getByRole('list', { name: 'Grammar rule cards' }).children);

afterEach(cleanup);

describe('GrammarTheoryCards — only what the author wrote', () => {
  it('renders no TOEIC or Signal Words block for a Foundation lesson', () => {
    const { container } = renderNotes(FOUNDATION_LESSON);

    // The five core/common cards are there...
    expect(cards()).toHaveLength(5);

    // ...and the optional, TOEIC-only blocks are absent in every form.
    expect(container.textContent).not.toMatch(/TOEIC/i);
    expect(container.textContent).not.toMatch(/signal words/i);
    expect(container.textContent).not.toMatch(/exam trap/i);
  });

  it('reserves no empty card for a block the lesson does not have', () => {
    // No Tips, no Common Mistakes, no Formula in this one.
    const { container } = renderNotes('## Concept\nA real concept.\n\n## Examples\nShe works.');

    expect(cards()).toHaveLength(2);
    expect(container.textContent).not.toMatch(/memory formula/i);
    expect(container.textContent).not.toMatch(/common mistake/i);
    expect(screen.queryByText('Tip')).not.toBeInTheDocument();
  });

  it('renders the summary last, outside the card grid', () => {
    renderNotes(FOUNDATION_LESSON);

    const grid = screen.getByRole('list', { name: 'Grammar rule cards' });
    expect(within(grid).queryByText('Lesson summary')).not.toBeInTheDocument();
    expect(screen.getByText('Lesson summary')).toBeInTheDocument();
    expect(screen.getByText(/routines, habits, and general truths/)).toBeInTheDocument();
  });
});

describe('GrammarTheoryCards — block rendering', () => {
  it('renders the formula verbatim from the lesson, with its own label', () => {
    renderNotes(FOUNDATION_LESSON);

    expect(screen.getByText('Memory formula')).toBeInTheDocument();
    expect(screen.getByText('Affirmative')).toBeInTheDocument();
    expect(screen.getByText('Subject + V / V-s/es')).toBeInTheDocument();
  });

  it('shows a real correction and adds none where the author wrote none', () => {
    renderNotes('## Common Mistakes\n❌ Him loves English.\n✅ He loves English.\n\n## Tips\n❌ She work.');

    expect(screen.getByText('Him loves English.')).toBeInTheDocument();
    expect(screen.getByText('He loves English.')).toBeInTheDocument();
    // The Tips block has a wrong line and no correction; nothing is generated.
    expect(screen.getByText(/She work\./)).toBeInTheDocument();
  });

  it('omits the translation line when the author supplied none', () => {
    renderNotes('## Examples\nShe works at a bank.\nI study English. — Tôi học tiếng Anh.');

    expect(screen.getByText('She works at a bank.')).toBeInTheDocument();
    expect(screen.getByText('Tôi học tiếng Anh.')).toBeInTheDocument();
    // Two examples, and only one of them has a second line.
    const exampleList = screen.getByText('She works at a bank.').closest('ul') as HTMLElement;
    const examples = within(exampleList).getAllByRole('listitem');
    expect(examples).toHaveLength(2);
    expect(examples[0].textContent).toBe('She works at a bank.');
  });

  it('renders a rule card with its number and remaining title', () => {
    renderNotes('## Rule 1 — Signal words\nUse Simple Past with "yesterday".');

    expect(screen.getByText('Grammar rule #1')).toBeInTheDocument();
    expect(screen.getByText('Signal words')).toBeInTheDocument();
  });

  it('falls back to one plain card when the notes carry no headings', () => {
    renderNotes('Just a paragraph the author typed with no structure.');

    expect(screen.getByText('Lesson notes')).toBeInTheDocument();
    expect(screen.getByText(/no structure/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Grammar rule cards' })).not.toBeInTheDocument();
  });
});

describe('GrammarTheoryCards — collapse', () => {
  const LONG_TIP = `## Tips
Line one of a genuinely long tip block.
Line two of a genuinely long tip block.
Line three of a genuinely long tip block.
Line four of a genuinely long tip block.
Line five of a genuinely long tip block.`;

  it('never offers a toggle on concept, rule, formula or examples', () => {
    renderNotes(FOUNDATION_LESSON);

    const grid = screen.getByRole('list', { name: 'Grammar rule cards' });
    // The only collapsible card here is Tips, and its body is short, so no
    // toggle should exist anywhere in the grid.
    expect(within(grid).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/I study English every day/)).toBeVisible();
  });

  it('collapses a long tips block and reopens it on demand', async () => {
    renderNotes(LONG_TIP);

    const toggle = screen.getByRole('button', { name: /show more/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(toggle);

    expect(screen.getByRole('button', { name: /show less/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Line three of a genuinely long tip block/)).toBeVisible();
  });
});
