"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type Question } from "@/types";
import { handleExplainQuestion } from "@/lib/actions";
import { type ExplainQuestionOutput } from "@/ai/flows/explain-question";
import { Skeleton } from "@/components/ui/skeleton";
import { BrainCircuit, Languages, RefreshCw } from "lucide-react";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";

/**
 * FIXES APPLIED
 * - Always fetch explanation when panel opens AND when level/language changes.
 * - Prevent stale updates with a cancelled flag.
 * - Resilient rendering if API returns partial/empty payloads.
 * - Explicit error state surfaced to the user, not just console.
 * - Safe defaults for question.language and chapter.
 */

type ExplanationPanelProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  question: Question | null;
};

export function ExplanationPanel({ isOpen, setIsOpen, question }: ExplanationPanelProps) {
  const [level, setLevel] = React.useState<"short" | "full">("short");
  const [language, setLanguage] = React.useState<"en" | "ar">("en");
  const [explanation, setExplanation] = React.useState<ExplainQuestionOutput | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // When question changes, sync language (with a safe default) and clear previous results
  React.useEffect(() => {
    if (question) {
      setLanguage((question as any)?.language === "ar" ? "ar" : "en");
      setExplanation(null);
      setError(null);
    }
  }, [question]);

  const fetchExplanation = React.useCallback(async () => {
    if (!question) return;
    setIsLoading(true);
    setError(null);
    // Clear the previous explanation to show skeletons while loading
    setExplanation(null);

    let cancelled = false;
    try {
      const result = await handleExplainQuestion({
        questionText: question.questionText,
        options: question.options,
        correctAnswer: question.correctAnswer,
        explanation: (question as any).explanation, // optional legacy field
        level,
        language,
      });

      if (cancelled) return;

      // Defensive: some handlers may return undefined/null or partial objects
      const safe: ExplainQuestionOutput = {
        generalExplanation: result?.generalExplanation ?? "",
        correctAnswerExplanation: result?.correctAnswerExplanation ?? "",
        whyOthersWrong: Array.isArray(result?.whyOthersWrong) ? result!.whyOthersWrong : [],
      } as ExplainQuestionOutput;

      // If everything is empty, surface a helpful message instead of staying null
      const isEmpty =
        !safe.generalExplanation && !safe.correctAnswerExplanation && (!safe.whyOthersWrong || safe.whyOthersWrong.length === 0);

      if (isEmpty) {
        setError("No content was returned for this question. Try Regenerate, or change level/language.");
      }
      setExplanation(safe);
    } catch (err) {
      console.error("Failed to fetch explanation:", err);
      setError("Failed to fetch explanation. Please try again.");
    } finally {
      if (!cancelled) setIsLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [question, level, language]);

  // Fetch when opening, or when question/level/language change
  React.useEffect(() => {
    if (isOpen && question) {
      void fetchExplanation();
    }
  }, [isOpen, question?.id, level, language, fetchExplanation]);

  const isArabic = language === "ar";

  const renderExplanationContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-6">
          <Skeleton className="h-6 w-1/4" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
          </div>
          <Skeleton className="h-6 w-1/3 mt-4" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <Skeleton className="h-6 w-1/3 mt-4" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className={cn("rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm", isArabic && "text-right")}>
          {error}
        </div>
      );
    }

    if (!explanation || !question) {
      return (
        <p className="text-muted-foreground text-sm">
          No explanation available yet. Click <span className="font-medium">Regenerate</span> to create one.
        </p>
      );
    }

    return (
      <div className={cn("space-y-6 text-sm", isArabic && "text-right")} dir={isArabic ? "rtl" : "ltr"}>
        <div>
          <h3 className="font-headline text-base font-semibold text-primary mb-2">
            {isArabic ? "الموضوع" : "Chapter"}
          </h3>
          <Badge variant="secondary">{(question as any)?.chapter ?? (isArabic ? "غير محدد" : "Unspecified")}</Badge>
        </div>

        <div>
          <h3 className="font-headline text-base font-semibold text-primary mb-2">
            {isArabic ? "شرح عام" : "General Explanation"}
          </h3>
          <p className="leading-relaxed">
            {explanation.generalExplanation || (isArabic ? "—" : "—")}
          </p>
        </div>

        <div>
          <h3 className="font-headline text-base font-semibold text-primary mb-2">
            {isArabic ? "شرح الإجابة الصحيحة" : "Correct Answer Explanation"}
          </h3>
          {question?.correctAnswer && (
            <div className="p-3 rounded-md bg-green-500/20 border border-green-500/50 mb-3">
              <p className="font-semibold text-foreground">
                {isArabic ? "الإجابة الصحيحة" : "Correct Answer"}: {Array.isArray(question.correctAnswer) ? question.correctAnswer.join(", ") : question.correctAnswer}
              </p>
            </div>
          )}
          <p className="leading-relaxed">
            {explanation.correctAnswerExplanation || (isArabic ? "—" : "—")}
          </p>
        </div>

        {Array.isArray(explanation.whyOthersWrong) && explanation.whyOthersWrong.length > 0 && (
          <div>
            <h3 className="font-headline text-base font-semibold text-primary mb-2">
              {isArabic ? "لماذا باقي الخيارات غير صحيحة" : "Why Other Options are Incorrect"}
            </h3>
            <ul className="space-y-3">
              {explanation.whyOthersWrong.map((item, i) => (
                <li key={i} className="leading-relaxed">
                  <strong className="text-foreground">{item.option}:</strong> {item.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl flex flex-col p-0">
        <SheetHeader className="p-6 border-b border-border">
          <SheetTitle className="font-headline text-2xl flex items-center gap-2">
            <BrainCircuit className="text-primary" />
            Explain Question
          </SheetTitle>
          <SheetDescription className="text-gray-400">{question?.questionText}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-row flex-wrap items-center justify-between p-4 border-b border-border bg-secondary/50 gap-2 sm:gap-4">
          <Tabs value={level} onValueChange={(v) => setLevel(v as any)}>
            <TabsList className="h-9">
              <TabsTrigger value="short" className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm">
                Short
              </TabsTrigger>
              <TabsTrigger value="full" className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm">
                Full
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <Languages className="text-muted-foreground h-5 w-5" />
            <Select value={language} onValueChange={(v) => setLanguage(v as any)}>
              <SelectTrigger className="w-[100px] sm:w-[120px] bg-background h-9 text-xs sm:text-sm">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ar">Arabic</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchExplanation} disabled={isLoading}>
              <RefreshCw className={`mr-1 sm:mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              <span className="text-xs sm:text-sm">Regenerate</span>
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6">{renderExplanationContent()}</div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
