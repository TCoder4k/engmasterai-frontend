import React, { useEffect, useState } from 'react';
import { ChevronLeft, BookOpen, Type, Headphones } from 'lucide-react';
import { CourseType } from '../../types';
import {
  PlacementReview,
  PlacementReviewItem,
  getPlacementAttemptReview,
} from '../../services/placementService';
import { StudentQuizQuestion } from '../../services/quizService';
import { useTranslation } from '../../i18n/useTranslation';
import ErrorState from '../shared/ErrorState';
import Skeleton from '../shared/Skeleton';
import QuizQuestionCard from '../lesson/quiz/QuizQuestionCard';
import PlacementAudioPlayer from './PlacementAudioPlayer';

interface PlacementReviewPanelProps {
  attemptId: string;
  onBack: () => void;
}

const SECTION_ORDER: CourseType[] = ['GRAMMAR', 'VOCABULARY', 'LISTENING'];

const toStudentQuizQuestion = (
  item: PlacementReviewItem,
  orderIndex: number,
): StudentQuizQuestion => ({
  id: item.questionId,
  type: item.type,
  difficulty: null,
  content: item.content,
  options: item.options,
  audioUrl: item.audioUrl,
  transcript: item.transcript,
  imageUrl: item.imageUrl,
  orderIndex,
  answered: null,
});

// "Xem chi tiết bài làm" — a read-only, server-graded breakdown of every
// question in a COMPLETED attempt, grouped by section. COMPOSED, NOT
// COPIED: reuses QuizQuestionCard/PlacementAudioPlayer exactly as
// PlacementTestStep does, just with `graded` populated (locked, correct
// answer revealed) instead of always null — the same shared card the live
// test screen uses, seen after the fact.
const PlacementReviewPanel: React.FC<PlacementReviewPanelProps> = ({ attemptId, onBack }) => {
  const { t } = useTranslation();
  const [review, setReview] = useState<PlacementReview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    setReview(null);
    getPlacementAttemptReview(attemptId)
      .then(setReview)
      .catch(() => setError(t.onboarding.reviewLoadFailed));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is stable
  // within a language session; re-running on attemptId alone is correct.
  useEffect(load, [attemptId]);

  const sectionCopy: Record<
    CourseType,
    { label: string; icon: React.ComponentType<{ size?: number; className?: string }> }
  > = {
    GRAMMAR: { label: t.onboarding.testSectionGrammar, icon: BookOpen },
    VOCABULARY: { label: t.onboarding.testSectionVocabulary, icon: Type },
    LISTENING: { label: t.onboarding.testSectionListening, icon: Headphones },
  };

  return (
    <div className="bg-white dark:bg-ink-900 rounded-3xl shadow-xl p-6 sm:p-8 space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
      >
        <ChevronLeft size={16} aria-hidden="true" />
        {t.onboarding.reviewBack}
      </button>

      <h2 className="text-xl font-black text-slate-900 dark:text-white">
        {t.onboarding.reviewTitle}
      </h2>

      {error && <ErrorState message={error} onRetry={load} />}

      {!error && !review && (
        <div className="space-y-3" aria-hidden="true">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      )}

      {review && (
        <div className="space-y-8">
          {SECTION_ORDER.map((section) => {
            const items = review.items.filter((item) => item.section === section);
            if (items.length === 0) return null;
            const correctCount = items.filter((item) => item.isCorrect).length;
            const copy = sectionCopy[section];
            const SectionIcon = copy.icon;

            return (
              <div key={section} className="space-y-4">
                <div className="flex items-center gap-2">
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center"
                    aria-hidden="true"
                  >
                    <SectionIcon size={16} />
                  </div>
                  <p className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">
                    {copy.label}
                  </p>
                  <span className="ml-auto text-xs font-bold text-slate-500 dark:text-slate-400">
                    {t.onboarding.resultCorrectCount(correctCount, items.length)}
                  </span>
                </div>

                {items.map((item) => {
                  const globalIndex = review.items.findIndex(
                    (i) => i.questionId === item.questionId,
                  );
                  return (
                    <div key={item.questionId}>
                      {item.submitted === null && (
                        <p className="mb-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                          {t.onboarding.reviewUnanswered}
                        </p>
                      )}
                      <QuizQuestionCard
                        question={toStudentQuizQuestion(item, globalIndex)}
                        index={globalIndex}
                        total={review.items.length}
                        value={item.submitted}
                        onChange={() => {}}
                        onEnter={() => {}}
                        graded={{ isCorrect: item.isCorrect, correctAnswer: item.correctAnswer }}
                        variant="placement"
                        renderAudio={({ audioUrl, transcript }) => (
                          <PlacementAudioPlayer audioUrl={audioUrl} transcript={transcript} />
                        )}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PlacementReviewPanel;
