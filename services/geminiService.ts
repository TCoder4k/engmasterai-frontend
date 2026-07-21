// Grammar-correction demo service — a permanent, deterministic mock
// (Sprint 01C). This is not "temporary until the real API is wired up":
// every Gemini/GenAI key-injection path was removed from this app, and no
// client-side AI integration is planned — a real implementation would need
// a server-side proxy, which is out of scope. Requires no key and makes no
// network call in any environment; see docs/memory.md's Sprint 01C entry.

export interface CorrectionResult {
  correctedText: string;
  explanation: string;
  naturalSuggestion: string;
  encouragement: string;
}

// A recognizable sentinel input that deterministically exercises the error
// path below — never something a real user would type by accident. Exists
// so the UI's error state (components/AIDemo.tsx) is actually testable,
// per the sprint's "support a controlled error behavior for testing"
// requirement.
export const MOCK_ERROR_TRIGGER = '__mock_error__';

export class MockCorrectionError extends Error {
  constructor() {
    super('Mock grammar-correction service error (deliberately triggered)');
    this.name = 'MockCorrectionError';
  }
}

export const getCorrection = async (
  text: string,
): Promise<CorrectionResult> => {
  // Simulate network latency so the loading state is exercised too.
  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (text.trim() === MOCK_ERROR_TRIGGER) {
    throw new MockCorrectionError();
  }

  return {
    correctedText: text,
    explanation:
      'Demo preview — this is a sample response, not a live AI correction.',
    naturalSuggestion: text,
    encouragement: 'Keep practicing — every sentence you write helps you improve!',
  };
};
