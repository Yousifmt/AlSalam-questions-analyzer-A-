"use client";

import { type Question } from "@/types";
import QuestionCard from "./question-card";
import { type ExamMode } from "@/app/page";
import { Button } from "../ui/button";

type QuestionListProps = {
  questions: Question[];
  allQuestions: Question[];
  onExplainClick: (question: Question) => void;
  onDelete: (questionId: string) => void;
  onUpdate: (question: Question) => void;
  showAllAnswers: boolean;
  isExamMode?: boolean;
  savedQuestionIds: string[];
  onToggleSave: (questionId: string) => void;
  onAnswerChange: (questionId: string, answer: string | string[]) => void;
  examAnswerMode?: ExamMode;
  isExamFinished?: boolean;
  userAnswers: Record<string, string | string[]>;
  onSubmitExam: () => void;
};

export default function QuestionList({ 
    questions, 
    allQuestions, 
    onExplainClick, 
    onDelete, 
    onUpdate, 
    showAllAnswers, 
    isExamMode = false,
    savedQuestionIds,
    onToggleSave,
    onAnswerChange,
    examAnswerMode,
    isExamFinished,
    userAnswers,
    onSubmitExam,
}: QuestionListProps) {
  return (
    <div className="p-4 space-y-4 max-w-screen-lg mx-auto w-full">
    {questions.length > 0 ? (
        questions.map((question, index) => (
        <QuestionCard
            key={question.id || index}
            question={question}
            allQuestions={allQuestions}
            onExplainClick={onExplainClick}
            onDelete={onDelete}
            onUpdate={onUpdate}
            showAllAnswers={showAllAnswers}
            isExamMode={isExamMode}
            questionNumber={index + 1}
            savedQuestionIds={savedQuestionIds}
            onToggleSave={onToggleSave}
            onAnswerChange={onAnswerChange}
            examAnswerMode={examAnswerMode}
            isExamFinished={isExamFinished}
            userAnswer={userAnswers[question.id] || null}
        />
        ))
    ) : (
        <div className="text-center py-16 text-gray-400">
        <h3 className="font-headline text-2xl mb-2 text-foreground">No Questions Found</h3>
        <p>Try adjusting your filters or search query.</p>
        </div>
    )}
      {isExamMode && !isExamFinished && questions.length > 0 && (
          <div className="py-8 flex justify-center">
              <Button size="lg" onClick={onSubmitExam}>Submit Exam</Button>
          </div>
      )}
    </div>
  );
}
