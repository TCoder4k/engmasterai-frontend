
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
}

export interface ManagedCourse extends Course {
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
}

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
}

export interface ManagedVocabDeck extends VocabDeck {
  isPublished: boolean;
  _count: { deckWords: number };
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