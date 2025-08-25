
"use client";

import * as React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type Question } from "@/types";
import { handleExplainQuestion } from "@/lib/actions";
import { type ExplainQuestionOutput } from "@/ai/flows/explain-question";
import { Skeleton } from "@/components/ui/skeleton";
import { BrainCircuit, Languages, RefreshCw } from "lucide-react";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";

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

  React.useEffect(() => {
    if (question) {
      setLanguage(question.language);
      setExplanation(null); // Reset explanation when question changes
    }
  }, [question]);

  const fetchExplanation = React.useCallback(async () => {
    if (!question) return;
    setIsLoading(true);
    setExplanation(null);
    try {
      const result = await handleExplainQuestion({
        questionText: question.questionText,
        options: question.options,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        level: level,
        language: language,
      });
      setExplanation(result);
    } catch (error) {
      console.error("Failed to fetch explanation:", error);
    } finally {
      setIsLoading(false);
    }
  }, [question, level, language]);
  
  React.useEffect(() => {
    if (isOpen && question) {
        fetchExplanation();
    }
  }, [isOpen, question, fetchExplanation]);


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

    if (!explanation || !question) {
      return <p className="text-muted-foreground">No explanation available. Click "Regenerate" to create one.</p>;
    }

    const isArabic = language === 'ar';

    return (
      <div className={cn("space-y-6 text-sm", isArabic && "text-right")} dir={isArabic ? 'rtl' : 'ltr'}>
        <div>
          <h3 className="font-headline text-base font-semibold text-primary mb-2">{isArabic ? "الموضوع" : "Chapter"}</h3>
          <Badge variant="secondary">{question.chapter}</Badge>
        </div>

        <div>
          <h3 className="font-headline text-base font-semibold text-primary mb-2">{isArabic ? "شرح عام" : "General Explanation"}</h3>
          <p className="leading-relaxed">{explanation.generalExplanation}</p>
        </div>
        
         <div>
          <h3 className="font-headline text-base font-semibold text-primary mb-2">{isArabic ? "شرح الإجابة الصحيحة" : "Correct Answer Explanation"}</h3>
           {question?.correctAnswer && (
              <div className="p-3 rounded-md bg-green-500/20 border border-green-500/50 mb-3">
                <p className="font-semibold text-foreground">
                   {isArabic ? 'الإجابة الصحيحة' : 'Correct Answer'}: {Array.isArray(question.correctAnswer) ? question.correctAnswer.join(', ') : question.correctAnswer}
                </p>
              </div>
            )}
          <p className="leading-relaxed">{explanation.correctAnswerExplanation}</p>
        </div>

        {explanation.whyOthersWrong && explanation.whyOthersWrong.length > 0 && (
            <div>
            <h3 className="font-headline text-base font-semibold text-primary mb-2">{isArabic ? "لماذا باقي الأسئلة غير صحيحة" : "Why Other Options are Incorrect"}</h3>
            <ul className="space-y-3">
                {explanation.whyOthersWrong.map((item, i) => (
                <li key={i} className="leading-relaxed"><strong className="text-foreground">{item.option}:</strong> {item.reason}</li>
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
            <BrainCircuit className="text-primary"/>
            Explain Question
          </SheetTitle>
          <SheetDescription className="text-gray-400">{question?.questionText}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-row flex-wrap items-center justify-between p-4 border-b border-border bg-secondary/50 gap-2 sm:gap-4">
            <Tabs value={level} onValueChange={(v) => setLevel(v as any)}>
              <TabsList className="h-9">
                <TabsTrigger value="short" className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm">Short</TabsTrigger>
                <TabsTrigger value="full" className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm">Full</TabsTrigger>
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
                    <RefreshCw className={`mr-1 sm:mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    <span className="text-xs sm:text-sm">Regenerate</span>
                </Button>
            </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6">
            {renderExplanationContent()}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
