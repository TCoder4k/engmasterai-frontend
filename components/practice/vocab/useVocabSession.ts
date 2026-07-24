import { useMemo, useReducer } from 'react';
import { VocabWordListItem } from '../../../types';
import { shuffleArray } from '../shuffle';

interface VocabSessionState {
  order: VocabWordListItem[];
  currentIndex: number;
  correctCount: number;
  isComplete: boolean;
}

type VocabSessionAction = { type: 'ANSWER'; correct: boolean };

const reducer = (state: VocabSessionState, action: VocabSessionAction): VocabSessionState => {
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
};

// Shared client-side-only session state for every vocabulary practice mode
// (flashcard/dictation/games). Order is shuffled once per session via the
// injectable shuffleArray (never a bare Math.random call in a component, so
// ordering is unit-testable). Nothing here is persisted — the result is
// discarded the moment the page is left; a real SRS session (Sprint 04)
// will be a separate, backend-backed hook, not an extension of this one.
export const useVocabSession = (words: VocabWordListItem[]) => {
  const order = useMemo(() => shuffleArray(words), [words]);
  const [state, dispatch] = useReducer(reducer, {
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
};
