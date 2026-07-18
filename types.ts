
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