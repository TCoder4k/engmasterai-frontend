import React, { useState } from 'react';
import { RotateCcw, X as XIcon, Check as CheckIcon, BookOpen } from 'lucide-react';
import { QuestionResult, StudentQuizQuestion, SubmittedAnswer } from '../../../services/quizService';
import { useTranslation } from '../../../i18n/useTranslation';
import { checkRetryAnswer } from './localGrade';
import MultipleChoiceInput from './MultipleChoiceInput';
import TrueFalseInput from './TrueFalseInput';
import FillBlankInput from './FillBlankInput';
import OrderingInput from './OrderingInput';

interface QuizReviewListProps {
  questions: StudentQuizQuestion[];
  results: QuestionResult[];
}

const formatAnswer = (question: StudentQuizQuestion | undefined, answer: unknown): string => {
  if (!question || answer === null || answer === undefined) return '—';
  const optionText = (id: string) => question.options?.find((o) => o.id === id)?.text ?? id;

  switch (question.type) {
    case 'MULTIPLE_CHOICE':
      return optionText((answer as { optionId: string }).optionId);
    case 'TRUE_FALSE':
      return (answer as { value: boolean }).value ? 'True' : 'False';
    case 'FILL_BLANK': {
      const a = answer as { text?: string; accepted?: string[] };
      return a.text ?? a.accepted?.[0] ?? '—';
    }
    case 'ORDERING':
      return (answer as { orderedOptionIds: string[] }).orderedOptionIds.map(optionText).join(' → ');
    default:
      return '—';
  }
};

// One card per INCORRECT question — a passed quiz's review section is
// simply empty rather than congratulating the student over an empty list.
// Each card offers an unscored retry: ❌ your answer, ✅ correct answer,
// 📖 explanation (only where authored — never generated), ↻ retry.
const QuizReviewList: React.FC<QuizReviewListProps> = ({ questions, results }) => {
  const { t } = useTranslation();
  const questionById = new Map(questions.map((q) => [q.id, q]));
  const incorrect = results.filter((r) => !r.isCorrect);

  const [retryOpenFor, setRetryOpenFor] = useState<string | null>(null);
  const [retryValue, setRetryValue] = useState<SubmittedAnswer | null>(null);
  const [retryOutcome, setRetryOutcome] = useState<Record<string, boolean>>({});

  if (incorrect.length === 0) return null;

  const openRetry = (questionId: string) => {
    setRetryOpenFor(questionId);
    setRetryValue(null);
    setRetryOutcome((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  };

  const checkRetry = (result: QuestionResult) => {
    const question = questionById.get(result.questionId);
    if (!question || retryValue === null) return;
    const isCorrect = checkRetryAnswer(question.type, result.correctAnswer, retryValue);
    setRetryOutcome((prev) => ({ ...prev, [result.questionId]: isCorrect }));
  };

  return (
    <div className="space-y-4 mt-6">
      {incorrect.map((result) => {
        const question = questionById.get(result.questionId);
        const isRetrying = retryOpenFor === result.questionId;
        const outcome = retryOutcome[result.questionId];

        return (
          <div
            key={result.questionId}
            className="border border-slate-100 dark:border-ink-700 rounded-2xl p-5 bg-slate-50/60 dark:bg-ink-950"
          >
            <p className="text-[15px] font-bold text-slate-900 dark:text-white mb-3">{question?.content}</p>

            <div className="space-y-1.5 text-sm">
              <p className="flex items-start gap-2 text-rose-600 dark:text-rose-400 font-semibold">
                <XIcon size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span>
                  {t.quiz.yourAnswerLabel}: {formatAnswer(question, result.submitted)}
                </span>
              </p>
              <p className="flex items-start gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckIcon size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span>
                  {t.quiz.correctAnswerLabel}: {formatAnswer(question, result.correctAnswer)}
                </span>
              </p>
              {result.explanation && (
                <p className="flex items-start gap-2 text-slate-600 dark:text-slate-300 font-medium pt-1">
                  <BookOpen size={15} className="mt-0.5 flex-shrink-0 text-indigo-400" aria-hidden="true" />
                  <span>
                    {t.quiz.explanationLabel}: {result.explanation}
                  </span>
                </p>
              )}
            </div>

            {!isRetrying ? (
              <button
                type="button"
                onClick={() => openRetry(result.questionId)}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded"
              >
                <RotateCcw size={13} aria-hidden="true" />
                {t.quiz.retryQuestionAction}
              </button>
            ) : (
              question && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-ink-700">
                  <span className="inline-block mb-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30">
                    {t.quiz.retryQuestionBadge}
                  </span>

                  {question.type === 'MULTIPLE_CHOICE' && question.options && (
                    <MultipleChoiceInput
                      options={question.options}
                      value={(retryValue as { optionId: string } | null)?.optionId ?? null}
                      onChange={(optionId) => setRetryValue({ optionId })}
                    />
                  )}
                  {question.type === 'TRUE_FALSE' && (
                    <TrueFalseInput
                      value={(retryValue as { value: boolean } | null)?.value ?? null}
                      onChange={(v) => setRetryValue({ value: v })}
                    />
                  )}
                  {question.type === 'FILL_BLANK' && (
                    <FillBlankInput
                      inputId={`retry-${result.questionId}`}
                      value={(retryValue as { text: string } | null)?.text ?? null}
                      onChange={(text) => setRetryValue({ text })}
                      onEnter={() => checkRetry(result)}
                    />
                  )}
                  {question.type === 'ORDERING' && question.options && (
                    <OrderingInput
                      options={question.options}
                      value={(retryValue as { orderedOptionIds: string[] } | null)?.orderedOptionIds ?? null}
                      onChange={(orderedOptionIds) => setRetryValue({ orderedOptionIds })}
                    />
                  )}

                  {outcome === undefined ? (
                    <button
                      type="button"
                      onClick={() => checkRetry(result)}
                      disabled={retryValue === null}
                      className="mt-3 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                    >
                      {t.quiz.submitAction}
                    </button>
                  ) : (
                    <p
                      aria-live="polite"
                      className={`mt-3 text-sm font-bold ${
                        outcome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {outcome ? t.quiz.retryCorrect : t.quiz.retryIncorrect}
                    </p>
                  )}
                </div>
              )
            )}
          </div>
        );
      })}
    </div>
  );
};

export default QuizReviewList;
