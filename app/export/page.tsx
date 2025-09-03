
"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type Question } from "@/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, ArrowLeft, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function ExportPage() {
  const [questions, setQuestions] = React.useState<Question[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const router = useRouter();
  const { toast } = useToast();

  React.useEffect(() => {
    try {
      // Add a small delay to allow loading state to be visible
      setTimeout(() => {
        const storedQuestions = sessionStorage.getItem("questionsForExport");
        if (storedQuestions) {
          setQuestions(JSON.parse(storedQuestions));
        } else {
          // Handle case where user lands here directly
          toast({
            title: "No questions to display",
            description: "Please go back and export questions first.",
            variant: "destructive"
          });
          router.push('/');
        }
        setIsLoading(false);
      }, 200);

    } catch (error) {
      console.error("Failed to parse questions from sessionStorage", error);
      toast({
        title: "Error loading questions",
        variant: "destructive"
      });
      setIsLoading(false);
    }
  }, [toast, router]);

  const generatePlainText = (questionsToExport: Question[]): string => {
    return questionsToExport.map(q => {
      let questionText = q.questionText;

      if (q.options && q.options.length > 0) {
        const optionsText = q.options.map((opt, i) => `${String.fromCharCode(65 + i)}.\t${opt}`).join('\n');
        questionText += `\n${optionsText}`;
      }

      if (q.correctAnswer) {
        let answerText = 'Answer:\t';
        if (q.options && q.options.length > 0) {
          const correctAnswers = Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer];
          const answerLetters = correctAnswers.map(ans => {
            const index = q.options?.indexOf(ans ?? '');
            return index !== -1 ? String.fromCharCode(65 + (index ?? 0)) : '';
          }).filter(Boolean).join(', ');
          answerText += answerLetters;
        } else {
          answerText += Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : q.correctAnswer;
        }
        questionText += `\n${answerText}`;
      }

      return questionText;
    }).join('\n\n');
  };

  const handleCopy = () => {
    if (questions.length === 0) return;

    const plainText = generatePlainText(questions);
    navigator.clipboard.writeText(plainText).then(() => {
      toast({
        title: "Copied to clipboard!",
        description: `${questions.length} questions have been formatted and copied.`,
      });
    }, (err) => {
      toast({
        title: "Failed to copy",
        description: "Could not copy questions to clipboard. See console for details.",
        variant: "destructive"
      });
      console.error('Could not copy text: ', err);
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/80 p-4 backdrop-blur-sm">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="font-headline text-2xl">Exported Questions</h1>
        <Button onClick={handleCopy} disabled={questions.length === 0 || isLoading}>
          <Copy className="mr-2 h-4 w-4" />
          Copy as Text
        </Button>
      </header>

      <main className="container mx-auto max-w-4xl p-4 sm:p-8">
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-4 text-muted-foreground">Loading questions...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {questions.length > 0 ? (
              questions.map((q, index) => (
                <Card key={q.id || index} className="overflow-hidden">
                  <CardContent className="p-6">
                    <p className="mb-4 whitespace-pre-wrap font-semibold">
                      <span className="font-bold mr-2">{index + 1}.</span>
                      {q.questionText}
                    </p>
                    {q.imageUrl && (
                      <div className="relative mb-4 aspect-video w-full max-w-lg mx-auto rounded-md border">
                        <Image
                          src={q.imageUrl}
                          alt={`Image for question ${index + 1}`}
                          fill
                          className="object-contain"
                        />
                      </div>
                    )}
                    {q.options && (
                      <ul className="mb-4 list-inside list-[upper-alpha] space-y-2">
                        {q.options.map((opt, i) => (
                          <li key={i}>{opt}</li>
                        ))}
                      </ul>
                    )}
                    <p className="text-muted-foreground">
                      <span className="font-bold text-foreground">Answer: </span>
                      {Array.isArray(q.correctAnswer)
                        ? q.correctAnswer.join(", ")
                        : q.correctAnswer}
                    </p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <h3 className="font-headline text-2xl mb-2">No Questions to Display</h3>
                <p>Go back to the main page and export a set of questions.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
