import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Lock, ShieldCheck, Target } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';
import { DURATION, EASE, SPRING } from '../../shared/motion';
import CelebrationBurst from '../../shared/CelebrationBurst';
import { playComplete } from '../../../services/feedbackSounds';

type SummaryKind = 'all-cleared' | 'no-traps' | 'blocked';

interface TrapHunterSummaryProps {
  kind: SummaryKind;
  total: number;
  // THE ACTION IS WHATEVER THIS STATE ACTUALLY UNBLOCKS. A blocked stage sends
  // the student to the quiz that would open it; a fully cleared one sends them
  // on to Advanced Practice, because clearing every trap is literally what
  // removes the `traps_outstanding` prerequisite.
  //
  // Sprint 06C originally gave the cleared state no action at all, reasoning
  // that NextLessonCard below already offered somewhere to go. QA found that
  // wrong: NextLessonCard goes to the next LESSON, so a student who had just
  // finished the correction round had no way forward within the lesson they
  // were still in, and had to scroll back up to the stage stepper.
  //
  // Both are optional. LessonPage passes onGoToPractice only when this lesson
  // has a practice task at all — a CTA into a stage that redirects straight
  // back to the video would be worse than no CTA.
  onGoToQuiz?: () => void;
  onGoToPractice?: () => void;
}

// Sprint 06C — the three states in which Trap Hunter has no trap on screen.
//
// They are deliberately three, not one. Before Sprint 06C's 'blocked' and
// 'skipped' statuses existed, all of this would have collapsed into a single
// "nothing here" panel, which says the wrong thing twice: to a student who
// hasn't finished the quiz it implies the feature is missing, and to one who
// scored 100% it implies they were skipped over rather than that they earned
// the empty stage.
//
// Still not a reward screen. There is no XP, no badge, no score and nothing
// earned or spendable — the burst and the chime mark a moment, they do not
// award a currency.
const TrapHunterSummary: React.FC<TrapHunterSummaryProps> = ({
  kind,
  total,
  onGoToQuiz,
  onGoToPractice,
}) => {
  const { t } = useTranslation();
  const cleared = kind === 'all-cleared';

  useEffect(() => {
    // Only for the one state the student actually worked for. A perfect
    // quiz already got its own celebration in the quiz summary, and
    // celebrating a blocked stage would be nonsense.
    if (cleared) playComplete();
  }, [cleared]);

  const { Icon, title, body, tone } = (() => {
    switch (kind) {
      case 'all-cleared':
        return {
          Icon: ShieldCheck,
          title: t.trapHunter.allClearedTitle,
          body: t.trapHunter.allClearedBody,
          tone: 'emerald' as const,
        };
      case 'no-traps':
        return {
          Icon: CheckCircle2,
          title: t.trapHunter.noTrapsTitle,
          body: t.trapHunter.noTrapsBody,
          tone: 'emerald' as const,
        };
      default:
        return {
          Icon: Lock,
          title: t.trapHunter.blockedTitle,
          body: t.trapHunter.blockedBody,
          tone: 'slate' as const,
        };
    }
  })();

  // ONE action, resolved here rather than two copies of the same button in two
  // branches of the JSX — the pill below is easy to change in one place and
  // easy to let drift in two.
  const action = (() => {
    if (kind === 'blocked' && onGoToQuiz) {
      return { label: t.trapHunter.goToQuizAction, onClick: onGoToQuiz };
    }
    if (cleared && onGoToPractice) {
      return {
        label: t.trapHunter.goToPracticeAction,
        onClick: onGoToPractice,
      };
    }
    return null;
  })();

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={SPRING}
      className={`relative overflow-hidden rounded-3xl border-2 p-8 text-center shadow-sm dark:shadow-xl ${
        tone === 'emerald'
          ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-500/10'
          : 'border-slate-200 bg-white dark:border-ink-700 dark:bg-ink-900'
      }`}
    >
      {cleared && <CelebrationBurst burstKey={1} size="large" />}

      <motion.span
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...SPRING, delay: 0.08 }}
        className={`relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${
          tone === 'emerald'
            ? 'bg-emerald-500 text-white'
            : 'bg-slate-100 text-slate-400 dark:bg-ink-950 dark:text-slate-500'
        }`}
      >
        <Icon size={26} aria-hidden="true" />
      </motion.span>

      <h2 className="relative text-xl font-black text-slate-900 dark:text-white">{title}</h2>
      <p className="relative mx-auto mt-2 max-w-md text-sm font-medium text-slate-600 dark:text-slate-300">
        {body}
      </p>

      {/* The only number on this screen, and it is a real count of the
          student's own corrected mistakes — not a score. */}
      {cleared && total > 0 && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.base, ease: EASE, delay: 0.16 }}
          className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-black text-emerald-700 dark:bg-ink-950 dark:text-emerald-300"
        >
          <Target size={13} aria-hidden="true" />
          {total} {t.trapHunter.clearedLabel}
        </motion.p>
      )}

      {action && (
        <div className="relative mt-6 flex justify-center">
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-blue-500/20 transition-all duration-300 hover:-translate-y-0.5 hover:from-blue-500 hover:to-indigo-500 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {action.label}
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      )}
    </motion.section>
  );
};

export default TrapHunterSummary;
