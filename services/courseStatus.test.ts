import { describe, it, expect } from 'vitest';
import { resolveLessonRowState, statusPresentation } from './courseStatus';
import { translations } from '../i18n/translations';
import { LessonStatus } from './courseProgressService';

// Sprint 08 — the status -> badge/CTA mapping, in BOTH locales.
//
// Six components render one of these. Before this mapping existed, one of them
// showed a hardcoded "Bắt đầu" on every lesson row regardless of progress, and
// the rest showed nothing at all.

const EN = translations.en;
const VI = translations.vi;

describe('statusPresentation', () => {
  // The table the product asked for, spelled out so a wrong pairing is a
  // failing test rather than something a reviewer has to notice.
  const cases: [LessonStatus, string, string, string, string][] = [
    ['NOT_STARTED', 'Ready to learn', 'Start', 'Sẵn sàng học', 'Bắt đầu'],
    ['IN_PROGRESS', 'In progress', 'Continue', 'Đang học dở', 'Học tiếp'],
    ['COMPLETED', 'Completed', 'Review again', 'Đã hoàn thành', 'Ôn tập lại'],
  ];

  it.each(cases)(
    '%s maps to the right badge and CTA in both locales',
    (status, enLabel, enCta, viLabel, viCta) => {
      expect(statusPresentation(status, EN)).toMatchObject({
        label: enLabel,
        cta: enCta,
        actionable: true,
      });
      expect(statusPresentation(status, VI)).toMatchObject({
        label: viLabel,
        cta: viCta,
      });
    },
  );

  it('never offers "Start" to a student who is mid-course', () => {
    // The case a percentage-driven mapping gets wrong: half-way through the
    // first lesson of five is 0%, but "Bắt đầu" would discard their place.
    expect(statusPresentation('IN_PROGRESS', VI).cta).toBe('Học tiếp');
    expect(statusPresentation('IN_PROGRESS', VI).cta).not.toBe('Bắt đầu');
  });

  it('marks a lesson with no completable content as not actionable', () => {
    const presentation = statusPresentation('NO_CONTENT', EN);
    expect(presentation.label).toBe('No content yet');
    expect(presentation.actionable).toBe(false);
    // Emphatically NOT "Ready to learn" — that is a false claim about a lesson
    // the student was never able to begin.
    expect(presentation.label).not.toBe(EN.course.statusNotStarted);
  });

  it('renders loading and error as themselves, never as a status', () => {
    expect(statusPresentation('loading', EN).actionable).toBe(false);
    expect(statusPresentation('error', EN).label).toBe('Progress unavailable');
    expect(statusPresentation('error', EN).actionable).toBe(false);
  });

  it('gives every status a distinct badge colour', () => {
    const classes = (['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'error'] as const).map(
      (state) => statusPresentation(state, EN).badgeClass,
    );
    expect(new Set(classes).size).toBe(classes.length);
  });
});

describe('resolveLessonRowState', () => {
  it('reports loading while the request is in flight, not NOT_STARTED', () => {
    // The flash this sprint removed: rows used to paint "Chưa học" and correct
    // themselves a moment later, which for a finished lesson is simply wrong.
    expect(resolveLessonRowState('loading', undefined)).toBe('loading');
    expect(resolveLessonRowState('loading', 'COMPLETED')).toBe('loading');
  });

  it('reports error rather than silently falling back to NOT_STARTED', () => {
    // Every progress .catch() used to set an empty map, which rendered as
    // "nothing started" — a lie the UI never took back.
    expect(resolveLessonRowState('error', undefined)).toBe('error');
    expect(resolveLessonRowState('error', 'COMPLETED')).toBe('error');
  });

  it('passes through the server status once ready', () => {
    expect(resolveLessonRowState('ready', 'IN_PROGRESS')).toBe('IN_PROGRESS');
    expect(resolveLessonRowState('ready', 'NO_CONTENT')).toBe('NO_CONTENT');
  });

  it('treats a lesson the server did not mention as NOT_STARTED', () => {
    // The lessons list and the progress summary are two independent requests,
    // so a lesson published between them appears in one and not the other.
    // A brand-new lesson genuinely has not been started — that is not an error.
    expect(resolveLessonRowState('ready', undefined)).toBe('NOT_STARTED');
  });
});
