"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { type Question } from "@/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Trash2, ShieldCheck } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { handleFindDuplicateQuestions, handleDeleteQuestion } from "@/lib/actions";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";

/* ---------------------------------- */
/* Helper: upgrade partial -> Question */
/* ---------------------------------- */
function toFullQuestion(partial: Partial<Question>, byId: Map<string, Question>): Question {
  // لو السؤال موجود كامل من فايرستور، رجّعه مباشرة
  const fromDb = partial?.id ? byId.get(partial.id) : undefined;
  if (fromDb) return fromDb;

  const now = new Date().toISOString();
  const options = Array.isArray(partial?.options) ? partial!.options! : [];
  const correct =
    typeof partial?.correctAnswer === "string" || Array.isArray(partial?.correctAnswer)
      ? partial!.correctAnswer!
      : (options[0] ?? "");

  return {
    id: partial?.id ?? (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `q_${Math.random().toString(36).slice(2)}`),
    questionText: partial?.questionText ?? "",
    options,
    correctAnswer: correct, // يطابق union: string | string[]
    chapter: partial?.chapter ?? "",
    subject: partial?.subject ?? "Cyber Security",
    questionType: partial?.questionType ?? "mcq",
    difficulty: partial?.difficulty ?? "medium",
    language: partial?.language ?? "en",
    createdAt: partial?.createdAt ?? now,
    updatedAt: partial?.updatedAt ?? now,
  };
}


export default function DuplicatesPage() {
  const [allQuestions, setAllQuestions] = React.useState<Question[]>([]);
  const [duplicateGroups, setDuplicateGroups] = React.useState<Question[][]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDeleting, setIsDeleting] = React.useState<Record<string, boolean>>({});
  const [removedCount, setRemovedCount] = React.useState(0);

  const router = useRouter();
  const { toast } = useToast();

  React.useEffect(() => {
    const fetchAndFindDuplicates = async () => {
      setIsLoading(true);
      try {
        // 1) Fetch all questions (نسخ كاملة من فايرستور)
        const questionsCollection = collection(db, "questions");
        const q = query(questionsCollection, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const questionsData = querySnapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Question)
        );
        setAllQuestions(questionsData);

        // 2) استخدم الـ AI للعثور على المجموعات المتشابهة (قد ترجع عناصر ناقصة الحقول)
        if (questionsData.length > 0) {
          const rawResults /* any[][] */ = await handleFindDuplicateQuestions({
            questionBank: questionsData
          });

          // تجاهل المجموعات التي أقل من عنصرين
          const actualDuplicates = (rawResults || []).filter(
            (group: any[]) => Array.isArray(group) && group.length > 1
          );

          // 3) Hydration: اربط كل عنصر جزئي بالنسخة الكاملة أو أنشئ نسخة كاملة افتراضيًا
          const byId = new Map(questionsData.map((q) => [q.id, q] as const));
          const hydrated: Question[][] = actualDuplicates.map((group: any[]) =>
            group.map((partial) => toFullQuestion(partial, byId))
          );

          setDuplicateGroups(hydrated);

          if (hydrated.length === 0) {
            toast({
              title: "No Duplicates Found",
              description: "The AI did not find any duplicate questions in your question bank."
            });
          }
        }
      } catch (error) {
        console.error("Error finding duplicates: ", error);
        toast({
          title: "Error",
          description: "Could not find duplicate questions. See console for details.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndFindDuplicates();
  }, [toast]);

  const handleRemoveDuplicates = async (group: Question[], keepId: string) => {
    if (!keepId) {
      toast({
        title: "No selection made",
        description: "Please select one question to keep.",
        variant: "destructive"
      });
      return;
    }

    const groupId = group[0].id;
    setIsDeleting((prev) => ({ ...prev, [groupId]: true }));

    const questionsToDelete = group.filter((q) => q.id !== keepId);
    let deletedCount = 0;

    for (const question of questionsToDelete) {
      try {
        const res = await handleDeleteQuestion(question.id);
        if (res?.success) {
          deletedCount++;
        } else {
          toast({
            title: `Error deleting Q# ${question.id}`,
            description: "The server returned success: false.",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error(`Failed to delete question ${question.id}`, error);
        toast({
          title: `Error deleting Q# ${question.id}`,
          variant: "destructive"
        });
      }
    }

    setRemovedCount((prev) => prev + deletedCount);
    // احذف المجموعة من الواجهة
    setDuplicateGroups((prev) => prev.filter((g) => g[0].id !== groupId));

    toast({
      title: "Duplicates Removed",
      description: `Removed ${deletedCount} question(s). Kept question ID: ${keepId}.`
    });

    setIsDeleting((prev) => ({ ...prev, [groupId]: false }));
  };

  const totalDuplicateQuestions = React.useMemo(() => {
    return duplicateGroups.reduce((acc, group) => acc + group.length, 0);
  }, [duplicateGroups]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/80 p-4 backdrop-blur-sm">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="font-headline text-2xl">Manage Duplicates</h1>
        <div className="w-[90px] text-right">
          {removedCount > 0 && (
            <div className="text-sm font-semibold text-destructive">Removed: {removedCount}</div>
          )}
        </div>
      </header>

      <main className="flex-1 container mx-auto max-w-4xl p-4 sm:p-8">
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-4 text-muted-foreground">Finding duplicate questions...</p>
          </div>
        ) : (
          <>
            {duplicateGroups.length > 0 ? (
              <div className="space-y-8">
                <p className="text-center text-muted-foreground">
                  Found {totalDuplicateQuestions} questions across {duplicateGroups.length} duplicate
                  groups.
                </p>
                {duplicateGroups.map((group, index) => (
                  <DuplicateGroupCard
                    key={group[0]?.id || index}
                    group={group}
                    groupIndex={index}
                    onRemove={handleRemoveDuplicates}
                    isDeleting={isDeleting[group[0]?.id] || false}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <ShieldCheck className="mx-auto h-16 w-16 text-green-500 mb-4" />
                <h3 className="font-headline text-2xl mb-2">No Duplicates Found</h3>
                <p>Your question bank is clean. Great job!</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

type DuplicateGroupCardProps = {
  group: Question[];
  groupIndex: number;
  onRemove: (group: Question[], keepId: string) => void;
  isDeleting: boolean;
};

function DuplicateGroupCard({ group, groupIndex, onRemove, isDeleting }: DuplicateGroupCardProps) {
  const [keepId, setKeepId] = React.useState<string>(group[0]?.id || "");

  if (!group || group.length < 2) return null;

  return (
    <Card className="border-2 border-amber-500/50 shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-xl">Duplicate Group #{groupIndex + 1}</CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup value={keepId} onValueChange={setKeepId}>
          <div className="space-y-4">
            {group.map((question) => (
              <div
                key={question.id}
                className="flex items-start space-x-4 rounded-md border p-4"
              >
                <RadioGroupItem value={question.id} id={question.id} className="mt-1" />
                <Label htmlFor={question.id} className="flex-1">
                  <p className="font-semibold">{question.questionText}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ID: {question.id} | Chapter: {question.chapter} | Options:{" "}
                    {question.options?.length || 0}
                  </p>
                </Label>
              </div>
            ))}
          </div>
        </RadioGroup>
      </CardContent>
      <CardFooter>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={isDeleting}>
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Remove {group.length - 1} Duplicate(s)
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete {group.length - 1} question(s). The question you selected
                to keep will remain. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => onRemove(group, keepId)}>
                Yes, delete duplicates
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
