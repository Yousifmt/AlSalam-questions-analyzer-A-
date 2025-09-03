
"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type Question } from "@/types";
import { type FindSimilarQuestionsOutput } from "@/ai/flows/find-similar-questions";
import { Sparkles } from "lucide-react";
import QuestionCard from "./question-card";
import { type ExamMode } from "@/app/page";

type SimilarQuestionsDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  originalQuestion: Question;
  similarQuestions: FindSimilarQuestionsOutput;
  allQuestions: Question[];
  onExplainClick: (question: Question) => void;
  onDelete: (questionId: string) => void;
  onUpdate: (question: Question) => void;
  savedQuestionIds: string[];
  onToggleSave: (questionId: string) => void;
  onAnswerChange: (questionId: string, answer: string | string[]) => void;
  userAnswer: string | string[] | null;
  isExamFinished?: boolean;
};

export function SimilarQuestionsDialog({ 
    isOpen, 
    setIsOpen, 
    originalQuestion, 
    similarQuestions, 
    allQuestions, 
    onExplainClick,
    onDelete,
    onUpdate,
    savedQuestionIds,
    onToggleSave,
    onAnswerChange,
    userAnswer,
    isExamFinished
}: SimilarQuestionsDialogProps) {
    
  const fullSimilarQuestions = React.useMemo(() => {
    return similarQuestions
        .map(sq => {
            const fullQuestion = allQuestions.find(q => q.id === sq.id);
            return fullQuestion ? { ...fullQuestion, similarityScore: sq.similarityScore } : null;
        })
        .filter((q): q is Question & { similarityScore: number } => q !== null);
  }, [similarQuestions, allQuestions]);
    
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center gap-2">
            <Sparkles className="text-primary"/>
            Similar Questions
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Showing questions with similar concepts to: "{originalQuestion.questionText}"
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 -mx-6">
            <div className="px-6 space-y-4">
                 {fullSimilarQuestions.length > 0 ? (
                    fullSimilarQuestions.map((q) => (
                       <QuestionCard 
                            key={q.id}
                            question={q}
                            allQuestions={allQuestions}
                            onExplainClick={onExplainClick}
                            onDelete={onDelete}
                            onUpdate={onUpdate}
                            similarityScore={q.similarityScore}
                            savedQuestionIds={savedQuestionIds}
                            onToggleSave={onToggleSave}
                            onAnswerChange={onAnswerChange}
                            userAnswer={userAnswer}
                            isExamFinished={isExamFinished}
                            showAllAnswers={false}
                       />
                    ))
                ) : (
                    <div className="flex items-center justify-center h-full text-center text-muted-foreground">
                       <p>No similar questions were found.</p>
                    </div>
                )}
            </div>
        </ScrollArea>

      </DialogContent>
    </Dialog>
  );
}

    

    