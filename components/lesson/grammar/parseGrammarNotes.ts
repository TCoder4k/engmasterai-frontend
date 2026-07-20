// Parses Lesson.notes into distinct grammar sections using a recognized
// `## Heading` markdown convention (design doc §7.3). Lesson.notes is one
// plain text field today — this parser is the frontend rendering
// convention on top of it, not a claim that structured content blocks
// exist in the schema.
//
// Decided edge-case behavior (never silently discard author content):
// - Missing headings: simply absent from the result — author-controlled
//   content variance, not a system gap.
// - No headings at all: the whole text becomes `fallbackText`.
// - Content before the first heading: kept as a leading, unheaded section
//   rather than dropped.
// - Empty section (heading with no body before the next heading): omitted.
// - Duplicate heading: bodies concatenated in appearance order.
// - HTML: stripped before rendering (text is also rendered as plain text
//   nodes downstream, so this is defense-in-depth, not the only guard).
// - Any parsing error: fails closed to the plain-text fallback rather than
//   a broken partial render.

export interface GrammarSection {
  heading: string; // '' for the leading, unheaded section (if any)
  body: string;
}

export interface ParsedGrammarNotes {
  sections: GrammarSection[];
  fallbackText: string | null;
}

const HEADING_LINE_RE = /^##\s+(.+?)\s*$/;

function sanitize(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

export function parseGrammarNotes(notes: string | null | undefined): ParsedGrammarNotes {
  if (!notes || !notes.trim()) {
    return { sections: [], fallbackText: null };
  }

  try {
    const lines = notes.split('\n');
    const sections: GrammarSection[] = [];
    const leading: string[] = [];
    let currentHeading: string | null = null;
    let currentBody: string[] = [];
    let sawHeading = false;

    const flush = () => {
      if (currentHeading === null) return;
      const body = sanitize(currentBody.join('\n')).trim();
      if (!body) return; // empty section — omitted
      const existing = sections.find((section) => section.heading === currentHeading);
      if (existing) {
        existing.body = `${existing.body}\n\n${body}`; // duplicate heading — concatenated
      } else {
        sections.push({ heading: currentHeading, body });
      }
    };

    for (const line of lines) {
      const match = line.match(HEADING_LINE_RE);
      if (match) {
        flush();
        currentHeading = match[1].trim();
        currentBody = [];
        sawHeading = true;
      } else if (currentHeading === null) {
        leading.push(line);
      } else {
        currentBody.push(line);
      }
    }
    flush();

    if (!sawHeading) {
      return { sections: [], fallbackText: sanitize(notes).trim() };
    }

    const leadingText = sanitize(leading.join('\n')).trim();
    if (leadingText) {
      sections.unshift({ heading: '', body: leadingText });
    }

    return { sections, fallbackText: null };
  } catch {
    return { sections: [], fallbackText: sanitize(notes).trim() };
  }
}
