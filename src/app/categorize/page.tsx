"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { type Question } from "@/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save, Wand2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { handleCategorizeQuestion, handleUpdateMultipleQuestions } from "@/lib/actions";

export default function CategorizePage() {
  const [allQuestions, setAllQuestions] = React.useState<Question[]>([]);
  const [updatedQuestions, setUpdatedQuestions] = React.useState<Question[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isCategorizing, setIsCategorizing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [processedCount, setProcessedCount] = React.useState(0);
  const [isComplete, setIsComplete] = React.useState(false);

  const router = useRouter();
  const { toast } = useToast();

  React.useEffect(() => {
    const fetchAllQuestions = async () => {
      try {
        const questionsCollection = collection(db, 'questions');
        const q = query(questionsCollection, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const questionsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
        setAllQuestions(questionsData);
      } catch (error) {
        console.error("Error fetching all questions: ", error);
        toast({
          title: "Error fetching questions",
          description: "Could not load questions from the database.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllQuestions();
  }, [toast]);

  const startCategorization = async () => {
    setIsCategorizing(true);
    setProgress(0);
    setProcessedCount(0);
    setIsComplete(false);
    
    let tempUpdated: Question[] = [];

    for (let i = 0; i < allQuestions.length; i++) {
        const question = allQuestions[i];
        try {
            // Re-use the single question categorization logic
            const result = await handleCategorizeQuestion(question);
            tempUpdated.push(result);
        } catch (error) {
            console.error(`Failed to categorize question ${question.id}:`, error);
            // Keep the original question if categorization fails
            tempUpdated.push(question); 
        }
        setProcessedCount(i + 1);
        setProgress(((i + 1) / allQuestions.length) * 100);
    }

    setUpdatedQuestions(tempUpdated);
    setIsCategorizing(false);
    setIsComplete(true);
    toast({
        title: "Categorization Complete!",
        description: "Review the changes and click 'Save Changes' to apply them.",
    });
  };

  const saveChanges = async () => {
    setIsSaving(true);
    try {
        const result = await handleUpdateMultipleQuestions(updatedQuestions);
        if (result.success) {
            toast({
                title: "Success!",
                description: "All questions have been updated in the database.",
            });
            router.push('/');
        } else {
            throw new Error("Batch update failed on the server.");
        }
    } catch(error) {
        console.error("Error saving multiple questions", error);
        toast({
            title: "Error Saving Changes",
            description: "Could not save the updated questions. See console for details.",
            variant: "destructive",
        });
    } finally {
        setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/80 p-4 backdrop-blur-sm">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="font-headline text-2xl">Batch Categorize Questions</h1>
        <div className="w-[90px]"></div>
      </header>

      <main className="flex-1 flex items-center justify-center">
        <div className="container mx-auto max-w-2xl p-4 sm:p-8 text-center">
            <div className="bg-card p-8 rounded-lg shadow-xl border border-border">
                <Wand2 className="mx-auto h-16 w-16 text-primary mb-4" />
                <h2 className="font-headline text-3xl mb-2">AI-Powered Categorization</h2>
                <p className="text-muted-foreground mb-6">
                    Let the AI analyze all your questions and assign them to the correct chapters automatically. This may take several minutes for a large number of questions.
                </p>

                {isLoading ? (
                    <div className="flex justify-center items-center py-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="ml-4 text-muted-foreground">Loading questions...</p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-4">
                            <Progress value={progress} className="h-4" />
                            <p className="text-sm text-muted-foreground">
                                {isCategorizing 
                                    ? `Categorizing: ${processedCount} / ${allQuestions.length} (${Math.round(progress)}%)` 
                                    : `Found ${allQuestions.length} questions to process.`}
                            </p>
                        </div>
                        
                        <div className="mt-8 space-x-4">
                            {!isCategorizing && !isComplete && (
                                <Button size="lg" onClick={startCategorization} disabled={allQuestions.length === 0}>
                                    <Wand2 className="mr-2 h-5 w-5" />
                                    Start Categorization
                                </Button>
                            )}

                            {isCategorizing && (
                                <Button size="lg" disabled>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Categorizing...
                                </Button>
                            )}

                             {isComplete && (
                                <Button size="lg" onClick={saveChanges} disabled={isSaving}>
                                    {isSaving ? (
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    ) : (
                                        <Save className="mr-2 h-5 w-5" />
                                    )}
                                    Save Changes
                                </Button>
                             )}
                        </div>
                    </>
                )}
            </div>
        </div>
      </main>
    </div>
  );
}
