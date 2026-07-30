
import React from 'react';

export interface Feature {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  content: string;
  avatar: string;
}

export interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

export type CourseType = 'GRAMMAR' | 'VOCABULARY' | 'LISTENING';

export interface Course {
  id: string;
  title: string;
  type: CourseType;
  description: string;
  thumbnail: string | null;
  isPublished: boolean;
  createdAt: string;
  // Sprint 05 — PUBLISHED lessons only (CourseService.PUBLIC_SELECT filters
  // the relation count). Not the same number as ManagedCourse's below.
  _count: { lessons: number };
  // Sprint 08 — summed estimatedStudyMinutes over PUBLISHED lessons, the
  // sibling of _count.lessons.
  //
  // It exists so a course card can show a duration without fetching every
  // lesson of every course to add them up, which is exactly what
  // GrammarRoadmapPage did — one lessons request per course, on top of one
  // progress request per course. Optional because admin-managed responses do
  // not carry it.
  totalEstimatedMinutes?: number;
}

export interface ManagedCourse extends Course {
  // Same shape, DIFFERENT meaning: the admin select counts every lesson
  // including drafts, so this can legitimately exceed the published count a
  // student sees for the same course.
  _count: { lessons: number };
}

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  notes: string | null;
  videoUrl: string | null;
  pdfUrl: string | null;
  audioUrl: string | null;
  videoDurationMinutes: number | null;
  estimatedStudyMinutes: number | null;
  learningObjectives: string[];
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
  // Sprint 06D — REPLACES `_count: { tasks: number }`, which counted
  // published QUIZ tasks only and could not be extended: Prisma cannot
  // express two differently-filtered counts of the same relation, so there
  // was nowhere to put "this lesson also has a published Practice task".
  //
  // The published task types this lesson actually has. Drafts never appear.
  // services/lessonProgress.ts derives lessonHasQuiz/lessonHasPractice from
  // it, and a future Vocabulary or Listening task needs no DTO change at all.
  publishedTaskTypes: LessonTaskType[];
}

export type LessonTaskType = 'VIDEO' | 'QUIZ' | 'PRACTICE';

export interface ManagedLesson extends Lesson {
  isPublished: boolean;
  _count: { tasks: number };
}

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface VocabLibrary {
  id: string;
  name: string;
  description: string;
  thumbnail: string | null;
  isPublished: boolean;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedVocabLibrary extends VocabLibrary {
  _count: { decks: number };
}

export interface VocabDeck {
  id: string;
  libraryId: string;
  name: string;
  description: string | null;
  thumbnail: string | null;
  cefrLevel: CefrLevel | null;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
  // Real word count — VocabDeckService's USER_SELECT (backend) already
  // includes this on both public deck endpoints (GET /vocab/decks/:id and
  // GET /vocab/libraries/:id/decks); this type was simply missing it even
  // though LibraryDetailPage/DeckDetailPage already read it at runtime.
  _count: { deckWords: number };
}

export interface ManagedVocabDeck extends VocabDeck {
  isPublished: boolean;
}

export type PartOfSpeech =
  | 'NOUN'
  | 'VERB'
  | 'ADJECTIVE'
  | 'ADVERB'
  | 'PRONOUN'
  | 'PREPOSITION'
  | 'CONJUNCTION'
  | 'INTERJECTION'
  | 'DETERMINER'
  | 'PHRASE'
  | 'IDIOM';

export type WordSource = 'ADMIN' | 'IMPORT' | 'AI';

export interface VocabWordMeaning {
  id: string;
  partOfSpeech: PartOfSpeech | null;
  meaning: string;
  orderIndex: number;
}

export interface VocabWordExample {
  id: string;
  sentence: string;
  translation: string | null;
  orderIndex: number;
}

// Lean shape returned inside a deck's word list (GET /vocab/decks/:deckId/words)
// — no `source`, no relation arrays, no examples (detail-only).
export interface VocabWordListItem {
  id: string;
  text: string;
  ipa: string | null;
  cefrLevel: CefrLevel | null;
  audioUrl: string | null;
  imageUrl: string | null;
  meanings: VocabWordMeaning[];
}

// Full student detail shape (GET /vocab/words/:id) — the visibility seam's
// response. No `source`: provenance is admin-only information.
export interface VocabWordDetail {
  id: string;
  text: string;
  ipa: string | null;
  audioUrl: string | null;
  imageUrl: string | null;
  cefrLevel: CefrLevel | null;
  synonyms: string[];
  antonyms: string[];
  collocations: string[];
  wordFamily: string[];
  meanings: VocabWordMeaning[];
  examples: VocabWordExample[];
}

// Bank list row (GET /vocab/words/manage) — admin triage shape.
export interface ManagedVocabWordRow {
  id: string;
  text: string;
  ipa: string | null;
  cefrLevel: CefrLevel | null;
  audioUrl: string | null;
  imageUrl: string | null;
  source: WordSource;
  createdAt: string;
  updatedAt: string;
  _count: { meanings: number; examples: number; deckWords: number };
}

// Full editor shape (GET /vocab/words/manage/:id, POST/PATCH responses).
export interface ManagedVocabWord {
  id: string;
  text: string;
  ipa: string | null;
  audioUrl: string | null;
  imageUrl: string | null;
  cefrLevel: CefrLevel | null;
  synonyms: string[];
  antonyms: string[];
  collocations: string[];
  wordFamily: string[];
  source: WordSource;
  createdAt: string;
  updatedAt: string;
  meanings: VocabWordMeaning[];
  examples: VocabWordExample[];
  _count: { deckWords: number };
}

// Deck-word row in the admin attached-words table (GET
// /vocab/decks/:deckId/words/manage) — includes the deck-scoped orderIndex.
export interface ManagedVocabDeckWordRow {
  orderIndex: number;
  word: {
    id: string;
    text: string;
    cefrLevel: CefrLevel | null;
    meanings: { meaning: string }[];
  };
}