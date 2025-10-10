// src/types.ts

export type CoreType = 'core1' | 'core2';
export type FirestoreDate = string | Date | { toDate: () => Date };

export type Question = {
  id: string;
  questionText: string;
  options?: string[];
  correctAnswer?: string | string[];
  explanation?: string;
  subject: string;
  chapter: string;
  topicTags?: string[];
  questionType: 'mcq' | 'checkbox';
  difficulty: 'easy' | 'medium' | 'hard';
  language: 'ar' | 'en';
  source?: string;

  // يسمح بتواريخ Firestore (Timestamp) أو string/Date
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;

  imageUrl?: string;

  // NEW: يحدد المجموعة (Core 1 / Core 2)
  core?: CoreType; // افتراضيًا عاملها core1 في الواجهة إذا كانت undefined
};
