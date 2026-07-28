import { QuestionType, SubmittedAnswer } from '../../../services/quizService';

// "Retry this question" (QuizReviewList) is unscored PRACTICE only — it
// posts nothing to the backend and never changes attemptsCount/score/
// completedAt (see QuizStage's own comment). It still needs to tell the
// student right/wrong immediately, so this is a client-side MIRROR of the
// backend's grade-question.ts, deliberately duplicated rather than shared:
// this file must never become a code path real scoring depends on — the
// backend is always the authority for anything that counts. If the two
// drift, the failure mode is a cosmetically-wrong practice hint, never a
// wrong score.
const normalizeFillBlank = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ');

export const checkRetryAnswer = (
  type: QuestionType,
  correctAnswer: unknown,
  submitted: SubmittedAnswer,
): boolean => {
  switch (type) {
    case 'MULTIPLE_CHOICE': {
      const answer = correctAnswer as { optionId: string };
      const sub = submitted as { optionId: string };
      return sub.optionId === answer.optionId;
    }
    case 'TRUE_FALSE': {
      const answer = correctAnswer as { value: boolean };
      const sub = submitted as { value: boolean };
      return sub.value === answer.value;
    }
    case 'FILL_BLANK': {
      const answer = correctAnswer as { accepted: string[] };
      const sub = submitted as { text: string };
      const normalized = normalizeFillBlank(sub.text ?? '');
      return answer.accepted.some((a) => normalizeFillBlank(a) === normalized);
    }
    case 'ORDERING': {
      const answer = correctAnswer as { orderedOptionIds: string[] };
      const sub = submitted as { orderedOptionIds: string[] };
      return (
        sub.orderedOptionIds.length === answer.orderedOptionIds.length &&
        sub.orderedOptionIds.every((id, i) => id === answer.orderedOptionIds[i])
      );
    }
    default:
      return false;
  }
};
