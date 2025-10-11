"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { type Question } from "@/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save, Wand2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { handleCategorizeQuestion, handleUpdateMultipleQuestions } from "@/lib/actions";

type Core = "core1" | "core2";

function parseCore(v: string | null): Core | null {
  if (!v) return null;
  const s = v.toLowerCase().replace(/\s+/g, "");
  if (s === "core2" || s === "2") return "core2";
  if (s === "core1" || s === "1") return "core1";
  return null;
}
function getInitialCore(): Core {
  const urlCore = parseCore(typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("core") : null);
  const saved = parseCore(typeof window !== "undefined" ? localStorage.getItem("selectedCore") : null);
  return urlCore ?? saved ?? "core1";
}

export default function Page() {
  return <CategorizeView />;
}

function CategorizeView() {
  const [activeCore, setActiveCore] = React.useState<Core>(() => getInitialCore());
  const [coreReady, setCoreReady] = React.useState(false);

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
    setCoreReady(true);
    try { localStorage.setItem("selectedCore", activeCore); } catch {}
  }, [activeCore]);

  // Query only current core
  React.useEffect(() => {
    if (!coreReady) return;
    const run = async () => {
      setIsLoading(true);
      try {
        const col = collection(db, "questions");
        let snap;
        try {
          // preferred (requires composite index: core ASC, createdAt DESC)
          snap = await getDocs(query(col, where("core", "==", activeCore), orderBy("createdAt", "desc")));
        } catch (err: any) {
          // Fallback if index not ready
          if (String(err?.message ?? "").toLowerCase().includes("requires an index")) {
            snap = await getDocs(query(col, where("core", "==", activeCore)));
          } else {
            throw err;
          }
        }
        const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Question[];
        // Ensure newest first if we used fallback
        list.sort((a, b) => Date.parse(String(b.createdAt ?? 0)) - Date.parse(String(a.createdAt ?? 0)));
        setAllQuestions(list);
      } catch (e) {
        console.error(e);
        toast({
          title: "Error fetching questions",
          description: `Could not load ${activeCore.toUpperCase()} questions.`,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    run();
  }, [coreReady, activeCore, toast]);

  const startCategorization = async () => {
    if (!allQuestions.length) {
      toast({ title: "No questions", description: `No ${activeCore.toUpperCase()} questions to categorize.` });
      return;
    }
    setIsCategorizing(true);
    setProgress(0); setProcessedCount(0); setIsComplete(false);

    const tmp: Question[] = [];
    for (let i = 0; i < allQuestions.length; i++) {
      const q = allQuestions[i];
      try {
        // Force the core so the LLM is constrained to that list
        const res = await handleCategorizeQuestion({ ...q, core: activeCore });
        tmp.push({ ...res, core: activeCore }); // NEVER allow switching cores
      } catch (e) {
        console.error(`Categorize failed for ${q.id}`, e);
        tmp.push({ ...q, core: activeCore });
      }
      const done = i + 1;
      setProcessedCount(done);
      setProgress((done / allQuestions.length) * 100);
    }
    setUpdatedQuestions(tmp);
    setIsCategorizing(false);
    setIsComplete(true);
    toast({
      title: "Categorization Complete!",
      description: `Reviewed ${allQuestions.length} ${activeCore.toUpperCase()} question(s).`,
    });
  };

  const saveChanges = async () => {
    setIsSaving(true);
    try {
      const res = await handleUpdateMultipleQuestions(updatedQuestions.map(q => ({ ...q, core: activeCore })));
      if (!res.success) throw new Error("Batch update failed");
      toast({ title: "Success!", description: `Updated ${updatedQuestions.length} question(s).` });
      router.push("/");
    } catch (e) {
      console.error(e);
      toast({
        title: "Error Saving Changes",
        description: "Could not save updates. See console for details.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/80 p-4 backdrop-blur-sm">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="flex flex-col items-center">
          <h1 className="font-headline text-2xl">Batch Categorize Questions</h1>
          <span className="text-xs text-muted-foreground mt-1">
            Active Core: <strong>{activeCore.toUpperCase()}</strong>
          </span>
        </div>
        <div className="w-[90px]" />
      </header>

      <main className="flex-1 flex items-center justify-center">
        <div className="container mx-auto max-w-2xl p-4 sm:p-8 text-center">
          <div className="bg-card p-8 rounded-lg shadow-xl border border-border">
            <Wand2 className="mx-auto h-16 w-16 text-primary mb-4" />
            <p className="text-muted-foreground mb-6">
              AI will assign a module <em>from this core only</em>. Core 1 = Modules 1–10. Core 2 = Modules 11–22.
            </p>

            {isLoading ? (
              <div className="flex justify-center items-center py-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-4 text-muted-foreground">Loading {activeCore.toUpperCase()} questions...</p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <Progress value={progress} className="h-4" />
                  <p className="text-sm text-muted-foreground">
                    {isCategorizing
                      ? `Categorizing: ${processedCount} / ${allQuestions.length} (${Math.round(progress)}%)`
                      : `Found ${allQuestions.length} ${activeCore.toUpperCase()} question(s).`}
                  </p>
                </div>

                <div className="mt-8 space-x-4">
                  {!isCategorizing && !isComplete && (
                    <Button size="lg" onClick={startCategorization} disabled={allQuestions.length === 0}>
                      <Wand2 className="mr-2 h-5 w-5" />
                      Start Categorization (Core {activeCore.toUpperCase()})
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
                      {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
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
