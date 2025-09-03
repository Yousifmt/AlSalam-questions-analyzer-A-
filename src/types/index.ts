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
  createdAt: string;
  updatedAt: string;
  imageUrl?: string;
};
