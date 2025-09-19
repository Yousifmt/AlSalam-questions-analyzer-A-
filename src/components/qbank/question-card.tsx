"use client";

import * as React from "react";
import Image from "next/image";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { type Question } from "@/types";
import {
  Bookmark, BrainCircuit, CheckCircle2, CheckSquare, Circle, Copy, Edit,
  MoreVertical, Sparkles, Trash2, Wand2, XCircle, Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { handleDeleteQuestion, handleFindSimilarQuestions, handleCategorizeQuestion, handleUpdateQuestion } from "@/lib/actions";
import { type FindSimilarQuestionsOutput } from "@/ai/flows/find-similar-questions";
import { SimilarQuestionsDialog } from "./similar-questions-dialog";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "../ui/alert-dialog";
import { EditQuestionDialog } from "./edit-question-dialog";
import { useLock } from "@/context/lock-context";
import { type ExamMode } from "@/app/page";

type QuestionCardProps = {
  question: Question;
  allQuestions: Question[];
  onExplainClick: (question: Question) => void;
  onDelete: (questionId: string) => void;
  onUpdate: (question: Question) => void;
  showAllAnswers: boolean;
  similarityScore?: number;
  isExamMode?: boolean;
  questionNumber?: number;
  savedQuestionIds: string[];
  onToggleSave: (questionId: string) => void;
  onAnswerChange: (questionId: string, answer: string | string[]) => void;
  examAnswerMode?: ExamMode;
  isExamFinished?: boolean;
  userAnswer: string | string[] | null;
};

// 🔹 helpers to detect "recent" (last 30 days)
const getCreatedAtDate = (val: any): Date | null => {
  if (!val) return null;
  if (typeof val?.toDate === "function") {
    try { return val.toDate(); } catch { /* ignore */ }
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};
const isRecent = (createdAt: any, days = 30) => {
  const d = getCreatedAtDate(createdAt);
  if (!d) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return d >= cutoff;
};

export default function QuestionCard({
  question,
  allQuestions,
  onExplainClick,
  onDelete,
  onUpdate,
  showAllAnswers,
  similarityScore,
  isExamMode = false,
  questionNumber,
  savedQuestionIds,
  onToggleSave,
  onAnswerChange,
  examAnswerMode = "during",
  isExamFinished = false,
  userAnswer,
}: QuestionCardProps) {
  const { toast } = useToast();
  const { isLocked } = useLock();
  const [isSimilarDialogOpen, setIsSimilarDialogOpen] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [similarQuestions, setSimilarQuestions] = React.useState<FindSimilarQuestionsOutput>([]);
  const [isFindingSimilar, setIsFindingSimilar] = React.useState(false);
  const [isCategorizing, setIsCategorizing] = React.useState(false);
  const [isAnswered, setIsAnswered] = React.useState(false);

  const isSaved = savedQuestionIds.includes(question.id);
  const isNew = isRecent((question as any).createdAt, 30); // 👈 NEW

  // Reset answered state if the question changes or we enter/exit exam mode
  React.useEffect(() => {
    setIsAnswered(false);
  }, [question, isExamMode]);

  // Auto-submit checkbox answers in certain modes
  React.useEffect(() => {
    if (
      question.questionType === "checkbox" &&
      Array.isArray(userAnswer) &&
      Array.isArray(question.correctAnswer) &&
      userAnswer.length > 0 &&
      userAnswer.length >= question.correctAnswer.length &&
      !isExamFinished
    ) {
      if ((isExamMode && examAnswerMode === "during") || !isExamMode) {
        setIsAnswered(true);
      }
    }
  }, [userAnswer, question, isExamMode, examAnswerMode, isExamFinished]);

  const findSimilar = async () => {
    setIsFindingSimilar(true);
    toast({ title: "Finding similar questions...", description: "This may take a moment." });
    try {
      const questionBank = allQuestions.map(q => ({ id: q.id, questionText: q.questionText }));
      const similar = await handleFindSimilarQuestions({
        question: { id: question.id, questionText: question.questionText },
        questionBank,
      });
      setSimilarQuestions(similar);
      setIsSimilarDialogOpen(true);
      if (similar.length === 0) {
        toast({
          title: "No Similar Questions Found",
          description: "Could not find any similar questions in the current question bank.",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Could not find similar questions.",
        variant: "destructive",
      });
    } finally {
      setIsFindingSimilar(false);
    }
  };

  const deleteQuestion = async () => {
    if (!question.id) {
      toast({ title: "Error", description: "Question ID not found.", variant: "destructive" });
      return;
    }
    try {
      const result = await handleDeleteQuestion(question.id);
      if (result.success) {
        toast({ title: "Question Deleted", description: "The question has been removed from the database." });
        onDelete(question.id);
      } else {
        toast({ title: "Error", description: "Could not delete the question.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not delete the question.", variant: "destructive" });
    }
  };

  const categorizeAndSaveQuestion = async () => {
    setIsCategorizing(true);
    try {
      const categorizedQuestionData = await handleCategorizeQuestion(question);
      const result = await handleUpdateQuestion(categorizedQuestionData);
      if (result.success) {
        onUpdate(categorizedQuestionData);
        toast({
          title: "Categorized!",
          description: `Question assigned to: ${categorizedQuestionData.chapter}`,
        });
      } else {
        throw new Error("Failed to save the updated question to the database.");
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
      toast({ title: "Categorization Failed", description: errorMessage, variant: "destructive" });
    } finally {
      setIsCategorizing(false);
    }
  };

  const handleOptionClick = (option: string) => {
    if (showAllAnswers || (isExamMode && isExamFinished) || isAnswered) return;

    let newAnswer: string | string[];

    if (question.questionType === "mcq") {
      newAnswer = option;
      if (!isExamFinished) {
        if ((isExamMode && examAnswerMode === "during") || !isExamMode) {
          setIsAnswered(true);
        }
      }
    } else if (question.questionType === "checkbox") {
      const currentSelection = (Array.isArray(userAnswer) ? userAnswer : []) as string[];
      newAnswer = currentSelection.includes(option)
        ? currentSelection.filter(item => item !== option)
        : [...currentSelection, option];

      const correctAnswersCount = Array.isArray(question.correctAnswer) ? question.correctAnswer.length : 1;

      if (newAnswer.length >= correctAnswersCount && !isExamFinished) {
        if ((isExamMode && examAnswerMode === "during") || !isExamMode) {
          setIsAnswered(true);
        }
      }
    } else {
      return;
    }

    if (onAnswerChange) onAnswerChange(question.id, newAnswer);
  };

  const showInstantResult =
    ((!isExamMode && isAnswered) ||
      (isExamMode && !isExamFinished && examAnswerMode === "during" && isAnswered));

  const getOptionClassName = (option: string) => {
    const isCorrect = Array.isArray(question.correctAnswer)
      ? question.correctAnswer.includes(option)
      : question.correctAnswer === option;
    const isSelected = Array.isArray(userAnswer)
      ? userAnswer.includes(option)
      : userAnswer === option;

    if (showAllAnswers || (isExamMode && isExamFinished) || showInstantResult) {
      if (isCorrect) return "bg-green-500/30 border-green-500 text-foreground cursor-default";
      if (isSelected && !isCorrect) return "bg-red-500/30 border-red-500 text-foreground cursor-default";
      if (showAllAnswers) return "border-border cursor-default";
      return "border-border opacity-60 cursor-default";
    }

    if (isSelected) return "border-primary bg-accent cursor-pointer";
    return "border-border hover:bg-accent cursor-pointer";
  };

  const getOptionIcon = (option: string) => {
    const isCorrect = Array.isArray(question.correctAnswer)
      ? question.correctAnswer.includes(option)
      : question.correctAnswer === option;
    const isSelected = Array.isArray(userAnswer)
      ? userAnswer.includes(option)
      : userAnswer === option;

    if (showAllAnswers || (isExamMode && isExamFinished) || showInstantResult) {
      if (isCorrect) return <CheckCircle2 className="h-5 w-5 text-green-400" />;
      if (isSelected && !isCorrect) return <XCircle className="h-5 w-5 text-red-400" />;
      return null;
    }

    if (isSelected) {
      if (question.questionType === "checkbox") return <CheckSquare className="h-5 w-5 text-primary" />;
      if (question.questionType === "mcq") return <Circle className="h-5 w-5 text-primary fill-current" />;
    }
    return null;
  };

  const cleanQuestionText = question.questionText.replace(
    /^(question\s*\d*\s*[:.)-]?\s*)|(^\d+\s*[:.)-]?\s*)/i,
    ""
  );

  return (
    <>
      <Card className="bg-card transition-colors duration-300 shadow-xl flex flex-col border-border">
        <CardHeader>
          <div className="flex justify-between items-start">
            <CardTitle className="font-normal text-base leading-relaxed">
              {questionNumber && <span className="font-bold mr-2">{questionNumber}.</span>}
              {cleanQuestionText}
              {isNew && (
                <Badge className="ml-2 uppercase">New</Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2 pl-4">
              {similarityScore && (
                <Badge variant={similarityScore > 0.8 ? "default" : "secondary"}>
                  Similarity: {(similarityScore * 100).toFixed(0)}%
                </Badge>
              )}
              {!isLocked && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setIsEditDialogOpen(true)}>
                      <Edit className="mr-2 h-4 w-4" />Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Copy className="mr-2 h-4 w-4" />Duplicate
                    </DropdownMenuItem>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem
                          onSelect={(e) => e.preventDefault()}
                          className="text-destructive focus:text-destructive-foreground focus:bg-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />Delete
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the question from the database.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={deleteQuestion}>Continue</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-grow">
          {question.imageUrl && (
            <div className="relative w-full max-w-2xl mx-auto aspect-video rounded-md overflow-hidden mb-4">
              <Image src={question.imageUrl} alt="Question image" fill objectFit="contain" />
            </div>
          )}

          {question.options && ["mcq", "checkbox"].includes(question.questionType) && (
            <div className="space-y-2 mt-2">
              {question.options.map((option, index) => (
                <div
                  key={index}
                  className={cn(
                    "p-3 rounded-md border flex items-center justify-between transition-all",
                    getOptionClassName(option)
                  )}
                  onClick={() => handleOptionClick(option)}
                >
                  <span className="text-card-foreground">{option}</span>
                  <div className="flex items-center gap-2">{getOptionIcon(option)}</div>
                </div>
              ))}
            </div>
          )}

          {showAllAnswers && !["mcq", "checkbox"].includes(question.questionType) && (
            <div className="mt-4 p-3 rounded-md bg-green-500/20 border border-green-500">
              <h4 className="font-semibold text-sm text-green-300">Correct Answer</h4>
              <p className="text-foreground">
                {Array.isArray(question.correctAnswer)
                  ? question.correctAnswer.join(", ")
                  : question.correctAnswer}
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{question.chapter}</Badge>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-1">
            {!isLocked && (
              <Button
                variant="card-outline"
                size="sm"
                className="px-2 text-xs sm:px-3 sm:text-sm"
                onClick={categorizeAndSaveQuestion}
                disabled={isCategorizing}
              >
                {isCategorizing ? (
                  <Loader2 className="mr-1 sm:mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-1 sm:mr-2 h-4 w-4" />
                )}
                <span className="sm:inline">Categorize</span>
              </Button>
            )}

            <Button
              variant="card-outline"
              size="sm"
              className="px-2 text-xs sm:px-3 sm:text-sm"
              onClick={() => onExplainClick(question)}
            >
              <BrainCircuit className="mr-1 sm:mr-2 h-4 w-4" />
              <span className="sm:inline">Explain</span>
            </Button>

            {!similarityScore && (
              <Button
                variant="card-outline"
                size="sm"
                className="px-2 text-xs sm:px-3 sm:text-sm"
                onClick={findSimilar}
                disabled={isFindingSimilar}
              >
                <Sparkles className={`mr-1 sm:mr-2 h-4 w-4 ${isFindingSimilar ? "animate-spin" : ""}`} />
                <span className="sm:inline">Find Similar</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", isSaved ? "text-primary" : "text-muted-foreground")}
              onClick={() => onToggleSave(question.id)}
            >
              <Bookmark className={cn("h-4 w-4", isSaved && "fill-current")} />
            </Button>
          </div>
        </CardFooter>
      </Card>

      <SimilarQuestionsDialog
        isOpen={isSimilarDialogOpen}
        setIsOpen={setIsSimilarDialogOpen}
        originalQuestion={question}
        similarQuestions={similarQuestions}
        allQuestions={allQuestions}
        onExplainClick={onExplainClick}
        onDelete={onDelete}
        onUpdate={onUpdate}
        savedQuestionIds={savedQuestionIds}
        onToggleSave={onToggleSave}
        onAnswerChange={onAnswerChange}
        userAnswer={userAnswer}
        isExamFinished={isExamFinished}
      />

      <EditQuestionDialog
        isOpen={isEditDialogOpen}
        setIsOpen={setIsEditDialogOpen}
        question={question}
        onQuestionUpdated={onUpdate}
      />
    </>
  );
}
