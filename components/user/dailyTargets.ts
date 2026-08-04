// Sprint 09 — the default daily targets behind Today's Progress.
//
// THESE ARE NOT MOCK DATA, and they deliberately do not live in
// dashboardContent.ts, whose whole header warns that everything inside it is a
// placeholder standing in for a student's real figures.
//
// The distinction that matters: a COUNT is a measurement, and inventing one is
// a lie about what the student did. A TARGET is configuration — a goal the
// product sets — and shipping a sensible default is an ordinary product
// decision, the same one Duolingo and Anki make. The old widget was dishonest
// because its numerators were fabricated (`2 / 5` where the 2 was invented too);
// the numerators are now server-derived, so a default denominator is fine.
//
// WHEN A PER-USER GOAL LANDS, this file is the single seam to replace: add the
// column, return it from the profile endpoint, and fall back to these values
// for anyone who has not set one. Nothing else in the dashboard needs to know.
export interface DailyTargets {
  stagesCompleted: number;
  taskAttempts: number;
  newWordsLearned: number;
  wordsReviewed: number;
  /** Sprint 10.5 — the Daily Goal widget's denominator. */
  studyMinutes: number;
}

export const DEFAULT_DAILY_TARGETS: DailyTargets = {
  // One lesson's worth of stages on a normal evening — a lesson offers up to
  // five, but few students finish a whole one in a sitting.
  stagesCompleted: 5,
  taskAttempts: 3,
  // Matches the SRS engine's own DEFAULT_NEW_LIMIT so the dashboard does not
  // set a goal the review queue will not hand out.
  newWordsLearned: 20,
  wordsReviewed: 50,
  // Sprint 10.5 — Daily Goal's target, and the number the widget showed as a
  // placeholder for three sprints. It stays 30 because that is what the design
  // has always promised; what changed is that the NUMERATOR beside it is now
  // measured rather than invented.
  //
  // A product default, not a per-user goal. It must never become an XP
  // multiplier: Sprint 09 flagged that a goal a student sets for themselves
  // would otherwise let them scale their own rewards.
  studyMinutes: 30,
};

/**
 * Percentage for a progress bar, clamped to 0-100.
 *
 * Clamped because exceeding a target is common and good: 30 words against a
 * goal of 20 must render a full bar, not one overflowing its track. The raw
 * `30 / 20` still shows beside it, so nothing is hidden by the clamp.
 */
export const targetPercent = (done: number, target: number): number => {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((done / target) * 100));
};
