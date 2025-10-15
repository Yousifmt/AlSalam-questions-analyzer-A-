// src/app/categorize/page.tsx
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { type Question } from "@/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save, Wand2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query as fsQuery,
  orderBy,
  where,
  limit,
  startAfter,
  documentId,
  Timestamp,
  type CollectionReference,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from "firebase/firestore";
import { handleCategorizeQuestion, handleUpdateMultipleQuestions } from "@/lib/actions";

type Core = "core1" | "core2";
const BATCH_SIZE = 500;

/** Firestore shape (بدون id) مع حقول createdAt متنوعة */
type QuestionFS = Omit<Question, "id"> & {
  core?: string | null;
  createdAt?: Timestamp | Date | string | null;
};

function parseCore(v: string | null): Core | null {
  if (!v) return null;
  const s = v.toLowerCase().replace(/\s+/g, "");
  if (s === "core2" || s === "2" || s === "c2") return "core2";
  if (s === "core1" || s === "1" || s === "c1") return "core1";
  return null;
}
const coreLabel = (c: Core) => (c === "core1" ? "Core 1" : "Core 2");

function toMs(v: unknown): number {
  try {
    if (v instanceof Timestamp) return v.toMillis();
    const anyV = v as { toDate?: () => Date };
    if (typeof anyV?.toDate === "function") return anyV.toDate().getTime();
    const n = Date.parse(String(v ?? ""));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function moduleNumberFromTitle(title?: string): number | null {
  if (!title) return null;
  const m = title.match(/module\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

function normalizeCoreValue(raw: unknown): Core | null {
  if (raw == null) return null;
  const s = String(raw).toLowerCase().trim();
  if (["core1", "core 1", "c1", "1"].includes(s)) return "core1";
  if (["core2", "core 2", "c2", "2"].includes(s)) return "core2";
  return null;
}

export default function Page() {
  return <CategorizeView />;
}

function CategorizeView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // ===== Core selection (URL -> localStorage -> default) =====
  const [activeCore, setActiveCore] = React.useState<Core>("core1");
  React.useEffect(() => {
    const urlCore = parseCore(searchParams.get("core"));
    if (urlCore) {
      setActiveCore(urlCore);
      try { localStorage.setItem("selectedCore", urlCore); } catch {}
      return;
    }
    try {
      const saved = parseCore(localStorage.getItem("selectedCore"));
      setActiveCore(saved ?? "core1");
    } catch {
      setActiveCore("core1");
    }
  }, [searchParams]);
  React.useEffect(() => {
    try { localStorage.setItem("selectedCore", activeCore); } catch {}
  }, [activeCore]);

  // ===== State =====
  const [allQuestions, setAllQuestions] = React.useState<Question[]>([]);
  const [updatedQuestions, setUpdatedQuestions] = React.useState<
    (Question & { _newChapter?: string; _moduleNum?: number | null })[]
  >([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isCategorizing, setIsCategorizing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [processedCount, setProcessedCount] = React.useState(0);
  const [isComplete, setIsComplete] = React.useState(false);

  // ===== robust fetch (handles missing/variant core values) =====
  const fetchAllForCore = React.useCallback(async (core: Core): Promise<Question[]> => {
    const colRef = collection(db, "questions") as CollectionReference<QuestionFS>;
    const rowsMap = new Map<string, Question>();

    const pushDoc = (doc: QueryDocumentSnapshot<QuestionFS>) => {
      const data = doc.data();
      rowsMap.set(doc.id, { id: doc.id, ...(data as unknown as Record<string, unknown>) } as Question);
    };

    // A) where(core == ..) + orderBy(createdAt desc)
    let needsEqFallback = false;
    try {
      let last: QueryDocumentSnapshot<QuestionFS> | null = null;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const qry: Query<QuestionFS> = last
          ? (fsQuery(colRef, where("core", "==", core), orderBy("createdAt", "desc"), startAfter(last), limit(BATCH_SIZE)) as Query<QuestionFS>)
          : (fsQuery(colRef, where("core", "==", core), orderBy("createdAt", "desc"), limit(BATCH_SIZE)) as Query<QuestionFS>);
        const page: QuerySnapshot<QuestionFS> = await getDocs(qry);
        if (page.empty) break;
        page.docs.forEach(pushDoc);
        last = page.docs[page.docs.length - 1] ?? null;
        if (page.size < BATCH_SIZE) break;
      }
    } catch (err) {
      const msg = String((err as { message?: string })?.message ?? "").toLowerCase();
      if (msg.includes("requires an index")) needsEqFallback = true;
      else throw err;
    }

    // A-fallback) where(core==..) + orderBy(documentId())
    if (needsEqFallback) {
      let last: QueryDocumentSnapshot<QuestionFS> | null = null;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const qry: Query<QuestionFS> = last
          ? (fsQuery(colRef, where("core", "==", core), orderBy(documentId()), startAfter(last), limit(BATCH_SIZE)) as Query<QuestionFS>)
          : (fsQuery(colRef, where("core", "==", core), orderBy(documentId()), limit(BATCH_SIZE)) as Query<QuestionFS>);
        const page: QuerySnapshot<QuestionFS> = await getDocs(qry);
        if (page.empty) break;
        page.docs.forEach(pushDoc);
        last = page.docs[page.docs.length - 1] ?? null;
        if (page.size < BATCH_SIZE) break;
      }
    }

    // B) where(core in [...variants]) لمحاولة صيغ شائعة
    const variants: string[] =
      core === "core1"
        ? ["core 1", "Core 1", "Core1", "CORE1", "1", "c1", "C1"]
        : ["core 2", "Core 2", "Core2", "CORE2", "2", "c2", "C2"];

    let triedInFallback = false;
    try {
      let last: QueryDocumentSnapshot<QuestionFS> | null = null;
      // eslint-disable-next-line no-constant-condition
      while (variants.length > 0) {
        const qry: Query<QuestionFS> = last
          ? (fsQuery(colRef, where("core", "in", variants as string[]), orderBy("createdAt", "desc"), startAfter(last), limit(BATCH_SIZE)) as Query<QuestionFS>)
          : (fsQuery(colRef, where("core", "in", variants as string[]), orderBy("createdAt", "desc"), limit(BATCH_SIZE)) as Query<QuestionFS>);
        const page: QuerySnapshot<QuestionFS> = await getDocs(qry);
        if (page.empty) break;
        page.docs.forEach(pushDoc);
        last = page.docs[page.docs.length - 1] ?? null;
        if (page.size < BATCH_SIZE) break;
      }
    } catch (err) {
      const msg = String((err as { message?: string })?.message ?? "").toLowerCase();
      if (msg.includes("requires an index")) triedInFallback = true;
      else if (msg.includes("invalid query") || msg.includes("not supported")) {
        // بعض المشاريع تمنع orderBy مع in — سنتجاهل هذه المحاولة ونكمل
      } else {
        throw err;
      }
    }

    // B-fallback) where in + orderBy(documentId())
    if (triedInFallback && variants.length > 0) {
      let last: QueryDocumentSnapshot<QuestionFS> | null = null;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const qry: Query<QuestionFS> = last
          ? (fsQuery(colRef, where("core", "in", variants as string[]), orderBy(documentId()), startAfter(last), limit(BATCH_SIZE)) as Query<QuestionFS>)
          : (fsQuery(colRef, where("core", "in", variants as string[]), orderBy(documentId()), limit(BATCH_SIZE)) as Query<QuestionFS>);
        const page: QuerySnapshot<QuestionFS> = await getDocs(qry);
        if (page.empty) break;
        page.docs.forEach(pushDoc);
        last = page.docs[page.docs.length - 1] ?? null;
        if (page.size < BATCH_SIZE) break;
      }
    }

    // C) مسح شامل بالـ documentId() + فلترة محلية (المفقود => core1)
    {
      let last: QueryDocumentSnapshot<QuestionFS> | null = null;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const qry: Query<QuestionFS> = last
          ? (fsQuery(colRef, orderBy(documentId()), startAfter(last), limit(BATCH_SIZE)) as Query<QuestionFS>)
          : (fsQuery(colRef, orderBy(documentId()), limit(BATCH_SIZE)) as Query<QuestionFS>);
        const page: QuerySnapshot<QuestionFS> = await getDocs(qry);
        if (page.empty) break;

        page.docs.forEach((docSnap) => {
          if (rowsMap.has(docSnap.id)) return; // موجود من (A/B)
          const data = docSnap.data();
          const normalized = normalizeCoreValue(data.core);
          const assumed: Core = (normalized ?? "core1");
          if (assumed === core) {
            rowsMap.set(docSnap.id, { id: docSnap.id, ...(data as unknown as Record<string, unknown>) } as Question);
          }
        });

        last = page.docs[page.docs.length - 1] ?? null;
        if (page.size < BATCH_SIZE) break;
      }
    }

    const rows = Array.from(rowsMap.values());
    rows.sort((a, b) => toMs((b as any).createdAt) - toMs((a as any).createdAt));
    return rows;
  }, []);

  // load data
  React.useEffect(() => {
    let cancel = false;
    const run = async () => {
      setIsLoading(true);
      setIsComplete(false);
      setUpdatedQuestions([]);
      setProgress(0);
      setProcessedCount(0);
      try {
        const list = await fetchAllForCore(activeCore);
        if (!cancel) setAllQuestions(list);
      } catch (e) {
        console.error(e);
        if (!cancel) {
          toast({
            title: "Error fetching questions",
            description: `Could not load ${coreLabel(activeCore)} questions.`,
            variant: "destructive",
          });
          setAllQuestions([]);
        }
      } finally {
        if (!cancel) setIsLoading(false);
      }
    };
    run();
    return () => { cancel = true; };
  }, [activeCore, fetchAllForCore, toast]);

  // ===== Actions =====
  const startCategorization = async () => {
    if (!allQuestions.length) {
      toast({ title: "No questions", description: `No ${coreLabel(activeCore)} questions to categorize.` });
      return;
    }
    setIsCategorizing(true);
    setProgress(0);
    setProcessedCount(0);
    setIsComplete(false);
    setUpdatedQuestions([]);

    const tmp: (Question & { _newChapter?: string; _moduleNum?: number | null })[] = [];

    for (let i = 0; i < allQuestions.length; i++) {
      const q = allQuestions[i];
      try {
        // نمرر كائن Question (مع core مفروض) إلى الأكشن
        const res = await handleCategorizeQuestion({ ...q, core: activeCore } as Question);
        const newChapter: string = (res as any)?.chapter ?? (q as any).chapter ?? "";
        const modNum = moduleNumberFromTitle(newChapter);

        const merged: Question = {
          ...(q as Question),
          core: activeCore,
          chapter: newChapter,
        };

        tmp.push({
          ...merged,
          _newChapter: newChapter,
          _moduleNum: modNum,
        });
      } catch (e) {
        console.error(`Categorize failed for ${q.id}`, e);
        const keepChapter = (q as any).chapter as string | undefined;
        tmp.push({
          ...(q as Question),
          core: activeCore,
          _newChapter: keepChapter,
          _moduleNum: moduleNumberFromTitle(keepChapter),
        });
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
      description: `Reviewed ${allQuestions.length} ${coreLabel(activeCore)} question(s).`,
    });
  };

  const saveChanges = async () => {
    if (!updatedQuestions.length) {
      toast({ title: "Nothing to save", description: "Run categorization first." });
      return;
    }
    setIsSaving(true);
    try {
      const payload: Question[] = updatedQuestions.map((q) => {
        const chapter = q._newChapter ?? (q as any).chapter;
        return {
          ...(q as Question),
          core: activeCore,
          chapter,
        } as Question;
      });

      const res = await handleUpdateMultipleQuestions(payload);
      if (!(res as any)?.success) throw new Error("Batch update failed");
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

  // ===== UI =====
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/80 p-4 backdrop-blur-sm">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="flex flex-col items-center">
          <h1 className="font-headline text-2xl">Batch Categorize Questions</h1>
          <div className="mt-2 flex items-center gap-2">
            <CoreToggle value={activeCore} onChange={setActiveCore} />
          </div>
        </div>

        <div className="w-[90px]" />
      </header>

      <main className="flex-1 flex items-center justify-center">
        <div className="container mx-auto max-w-3xl p-4 sm:p-8">
          <div className="bg-card p-6 sm:p-8 rounded-lg shadow-xl border border-border">
            <p className="text-muted-foreground mb-6 text-center">
              AI will assign a module <em>from this core only</em>. Core 1 = Modules 1–10. Core 2 = Modules 11–22.
            </p>

            {isLoading ? (
              <div className="flex justify-center items-center py-6">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-4 text-muted-foreground">Loading {coreLabel(activeCore)} questions...</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <Stat title="Core" value={coreLabel(activeCore)} />
                  <Stat title="Total Questions" value={String(allQuestions.length)} />
                  <Stat title="Updated (Preview)" value={String(updatedQuestions.length)} />
                </div>

                <div className="space-y-2 mb-6">
                  <Progress value={progress} className="h-4" />
                  <p className="text-sm text-muted-foreground text-center">
                    {isCategorizing
                      ? `Categorizing: ${processedCount} / ${allQuestions.length} (${Math.round(progress)}%)`
                      : isComplete
                      ? `Categorized ${updatedQuestions.length} question(s).`
                      : `Ready: ${allQuestions.length} question(s) found.`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
                  {!isCategorizing && !isComplete && (
                    <Button size="lg" onClick={startCategorization} disabled={allQuestions.length === 0}>
                      <Wand2 className="mr-2 h-5 w-5" />
                      Start Categorization ({coreLabel(activeCore)})
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

                {isComplete && (
                  <div className="mt-6 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-muted-foreground border-b">
                          <th className="text-left py-2 pr-3">#</th>
                          <th className="text-left py-2 pr-3">Question</th>
                          <th className="text-left py-2 pr-3">Assigned Module</th>
                          <th className="text-left py-2 pr-3">Core</th>
                        </tr>
                      </thead>
                      <tbody>
                        {updatedQuestions.slice(0, 100).map((q, i) => (
                          <tr key={q.id ?? i} className="border-b last:border-b-0">
                            <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                            <td className="py-2 pr-3">
                              {q.questionText?.slice(0, 90) || "(no text)"}
                              {q.questionText && q.questionText.length > 90 ? "…" : ""}
                            </td>
                            <td className="py-2 pr-3">
                              {q._newChapter ?? (q as any).chapter ?? "-"}{" "}
                              {typeof moduleNumberFromTitle(q._newChapter ?? (q as any).chapter) === "number" ? (
                                <span className="text-muted-foreground">
                                  {" "}
                                  (Module {moduleNumberFromTitle(q._newChapter ?? (q as any).chapter)})
                                </span>
                              ) : null}
                            </td>
                            <td className="py-2 pr-3">{coreLabel(activeCore)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {updatedQuestions.length > 100 && (
                      <p className="mt-2 text-xs text-muted-foreground text-center">
                        Showing first 100 of {updatedQuestions.length}. (All will be saved.)
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/* ===== Small UI bits ===== */
function CoreToggle({ value, onChange }: { value: Core; onChange: (c: Core) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        className={`px-3 py-1.5 text-sm ${value === "core1" ? "bg-primary text-primary-foreground" : "bg-card"}`}
        onClick={() => onChange("core1")}
        aria-pressed={value === "core1"}
      >
        Core 1
      </button>
      <button
        type="button"
        className={`px-3 py-1.5 text-sm border-l border-border ${value === "core2" ? "bg-primary text-primary-foreground" : "bg-card"}`}
        onClick={() => onChange("core2")}
        aria-pressed={value === "core2"}
      >
        Core 2
      </button>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3 text-center">
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="text-lg font-medium">{value}</div>
    </div>
  );
}
