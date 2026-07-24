import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from '../../user/StudentLayout';
import EmptyState from '../../shared/EmptyState';
import { useTranslation } from '../../../i18n/useTranslation';
import { Headphones, Clock, ListOrdered } from 'lucide-react';
import {
  getLessonSummaries,
  LISTENING_CONTENT_VERSION,
  ListeningLessonSummary,
  ListeningLevel,
  ListeningTopic,
} from './listeningContent';
import { getActiveListeningSessions } from './listeningSessionStore';

// /practice/listening — the Listening lesson catalog (Sprint 03E). Every
// count on this page (topic counts, level counts, sentence counts, minutes)
// is DERIVED from the real seed dataset at render time — nothing is
// hardcoded or fabricated. Card artwork is a CSS gradient + icon (project-
// owned, no third-party imagery). The content is a static, versioned local
// module, so there is no network loading/error state to fake — the only
// honest empty state is "no lessons match the current filters."
//
// "Continue Learning" renders ONLY from the in-memory session store
// (listeningSessionStore) — real activity from THIS browser session; a
// refresh clears it, which is the truthful behavior while no persistence
// backend exists.
const ListeningCatalogPage: React.FC = () => {
  const { t } = useTranslation();
  const [topicFilter, setTopicFilter] = useState<ListeningTopic | 'all'>('all');
  const [levelFilter, setLevelFilter] = useState<ListeningLevel | 'all'>('all');

  const summaries = useMemo(() => getLessonSummaries(), []);
  const activeSessions = getActiveListeningSessions();

  const topics = useMemo(() => {
    const counts = new Map<ListeningTopic, number>();
    for (const lesson of summaries) counts.set(lesson.topic, (counts.get(lesson.topic) || 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [summaries]);

  const levels = useMemo(() => {
    const order: ListeningLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
    const present = new Set(summaries.map((lesson) => lesson.level));
    return order.filter((level) => present.has(level));
  }, [summaries]);

  const filtered = summaries.filter(
    (lesson) =>
      (topicFilter === 'all' || lesson.topic === topicFilter) &&
      (levelFilter === 'all' || lesson.level === levelFilter),
  );

  const chipClass = (active: boolean) =>
    `px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
      active
        ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow'
        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
    }`;

  const lessonCard = (lesson: ListeningLessonSummary, sessionBadge?: string) => (
    <Link
      key={lesson.id}
      to={`/practice/listening/${lesson.id}`}
      className="group bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-500/40 transition-all overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
    >
      <div className="relative h-24 bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center">
        <Headphones size={30} className="text-white/90" aria-hidden="true" />
        <span className="absolute top-2 left-2 px-2 py-0.5 bg-white/90 dark:bg-slate-950/80 text-indigo-600 dark:text-indigo-300 text-[10px] font-black rounded-md uppercase">
          {lesson.level}
        </span>
        {sessionBadge && (
          <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-slate-950/70 text-white text-[10px] font-bold rounded-md">
            {sessionBadge}
          </span>
        )}
      </div>
      <div className="p-4 space-y-1.5">
        <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100 leading-snug break-words group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {lesson.title}
        </p>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 line-clamp-2">{lesson.description}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 pt-1">
          <span>{lesson.topic}</span>
          <span className="inline-flex items-center gap-1">
            <ListOrdered size={12} aria-hidden="true" />
            {lesson.segmentCount} {t.practice.sentencesUnit}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock size={12} aria-hidden="true" />
            {lesson.estimatedMinutes} {t.lesson.minutesUnit}
          </span>
        </div>
      </div>
    </Link>
  );

  return (
    <StudentLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-[22px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
            {t.practice.listeningSection}
          </h1>
          <div className="h-1 w-12 bg-gradient-to-r from-indigo-500 to-violet-500 mt-2.5 rounded-full" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-3">
            {t.practice.listeningCatalogSubtitle}
          </p>
          <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-1">
            {t.practice.listeningSeedNotice}{' '}
            <span className="font-mono text-slate-300 dark:text-slate-600">({LISTENING_CONTENT_VERSION})</span>
          </p>
        </div>

        <div className="space-y-3">
          <div role="group" aria-label={t.practice.allTopics} className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setTopicFilter('all')} className={chipClass(topicFilter === 'all')}>
              {t.practice.allTopics} ({summaries.length})
            </button>
            {topics.map(([topic, count]) => (
              <button
                key={topic}
                type="button"
                onClick={() => setTopicFilter(topic)}
                className={chipClass(topicFilter === topic)}
              >
                {topic} ({count})
              </button>
            ))}
          </div>

          <div role="group" aria-label={t.practice.allLevels} className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setLevelFilter('all')} className={chipClass(levelFilter === 'all')}>
              {t.practice.allLevels}
            </button>
            {levels.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setLevelFilter(level)}
                className={chipClass(levelFilter === level)}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {activeSessions.length > 0 && (
          <section aria-labelledby="listening-continue-heading" className="space-y-3">
            <h2
              id="listening-continue-heading"
              className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide"
            >
              {t.dashboard.continueLearning}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeSessions.map((session) => {
                const lesson = summaries.find((l) => l.id === session.lessonId);
                if (!lesson) return null;
                // Real, session-only counts (solved sentences this session);
                // never presented as saved progress.
                return lessonCard(lesson, `${session.solvedSegmentIds.length}/${session.totalSegments}`);
              })}
            </div>
          </section>
        )}

        <section aria-labelledby="listening-new-heading" className="space-y-3">
          <h2
            id="listening-new-heading"
            className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide"
          >
            {t.practice.newLessons}
          </h2>

          {filtered.length === 0 ? (
            <EmptyState icon={<Headphones size={32} />} message={t.common.noDataYet} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((lesson) => lessonCard(lesson))}
            </div>
          )}
        </section>
      </div>
    </StudentLayout>
  );
};

export default ListeningCatalogPage;
