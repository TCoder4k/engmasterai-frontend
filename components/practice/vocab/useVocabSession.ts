import { useMemo, useReducer } from 'react';
import { shuffleArray } from '../shuffle';

interface VocabSessionState<T> {
  order: T[];
  currentIndex: number;
  correctCount: number;
  isComplete: boolean;
}

type VocabSessionAction = { type: 'ANSWER'; correct: boolean };

function reducer<T>(state: VocabSessionState<T>, action: VocabSessionAction): VocabSessionState<T> {
  switch (action.type) {
    case 'ANSWER': {
      const nextIndex = state.currentIndex + 1;
      return {
        ...state,
        currentIndex: nextIndex,
        correctCount: state.correctCount + (action.correct ? 1 : 0),
        isComplete: nextIndex >= state.order.length,
      };
    }
    default:
      return state;
  }
}

// Shared client-side-only session state for every vocabulary practice mode
// (flashcard/dictation/games/personal-vocab review). Order is shuffled once
// per session via the injectable shuffleArray (never a bare Math.random call
// in a component, so ordering is unit-testable). Nothing here is persisted —
// the result is discarded the moment the page is left; a real SRS session
// (Sprint 04) is a separate, backend-backed concern layered on top by each
// caller, not something this hook itself tracks.
//
// Generic over T (not hardwired to VocabWordListItem) since "Từ vựng của
// tôi"'s PersonalFlashcardSession/PersonalDictationSession reuse this exact
// session-progression logic over PersonalVocabWord — a different shape, the
// same pure shuffle/advance/complete state machine.
export function useVocabSession<T>(words: T[]) {
  const order = useMemo(() => shuffleArray(words), [words]);
  const [state, dispatch] = useReducer(reducer<T>, {
    order,
    currentIndex: 0,
    correctCount: 0,
    isComplete: order.length === 0,
  });

  const currentWord = state.order[state.currentIndex] ?? null;

  const answer = (correct: boolean) => dispatch({ type: 'ANSWER', correct });

  return {
    currentWord,
    index: state.currentIndex,
    total: state.order.length,
    correctCount: state.correctCount,
    isComplete: state.isComplete,
    answer,
  };
}
