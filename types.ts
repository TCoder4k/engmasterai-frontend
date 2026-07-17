
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