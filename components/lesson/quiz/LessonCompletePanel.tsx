import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { PartyPopper } from 'lucide-react';
import { Lesson } from '../../../types';
import { SubmitQuizResponse } from '../../../services/quizService';
import { useTranslation } from '../../../i18n/useTranslation';
import { playComplete } from '../../../services/feedbackSounds';
import { AnimatedCounter, SPRING, StaggerContainer, StaggerItem } from '../../shared/motion';
import CelebrationBurst from '../../shared/CelebrationBurst';
import NextLessonCard from '../NextLessonCard';

interface LessonCompletePanelProps {
  result: SubmitQuizResponse;
  courseId: string;
  currentLesson: Lesson;
  allLessons: Lesson[];
}

// A short closing screen shown once Continue is pressed on a PASSED quiz.
//
// Still NOT a reward screen — no XP, no badge, no streak, and the only
// numbers are the two already shown in QuizSummary. Sprint 06B.5 added a
// burst and a chime, which mark the moment without inventing a currency to
// award: nothing here is earned, stored or spendable. NextLessonCard already
// handles both the "next lesson" and "course complete" cases correctly
// (Sprint 06), reused as-is rather than reimplemented.
const LessonCompletePanel: React.FC<LessonCompletePanelProps> = ({ result, courseId, currentLesson, allLessons }) => {
  const { t } = useTranslation();

  useEffect(() => {
    playComplete();
  }, []);

  return (
    <StaggerContainer className="space-y-5">
      <StaggerItem>
        <div className="relative bg-white dark:bg-ink-900 border border-slate-100 dark:border-ink-700 rounded-3xl p-8 shadow-sm dark:shadow-xl text-center">
          <div className="relative w-14 h-14 mx-auto mb-4">
            <CelebrationBurst burstKey={1} size="large" />
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={SPRING}
              className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center"
            >
              <PartyPopper size={26} className="text-white" aria-hidden="true" />
            </motion.div>
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white mb-1">{t.quiz.lessonCompleteTitle}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
            {t.quiz.accuracyLabel}: <AnimatedCounter value={result.accuracyPercent} suffix="%" /> ·{' '}
            {result.correctCount}/{result.totalCount} {t.quiz.questionsUnit}
          </p>
        </div>
      </StaggerItem>

      <StaggerItem>
        <NextLessonCard courseId={courseId} currentLesson={currentLesson} allLessons={allLessons} />
      </StaggerItem>
    </StaggerContainer>
  );
};

export default LessonCompletePanel;
