"use client";

import * as React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { handleParseQuestions, handleSaveQuestions } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { type Question } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

type PasteParserDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onQuestionsAdded: (newQuestions: Question[]) => void;
};

type CoreType = "core1" | "core2";
const CORE_KEY = "qbank.defaultCore";

export function PasteParserDialog({ isOpen, setIsOpen, onQuestionsAdded }: PasteParserDialogProps) {
  const [text, setText] = React.useState("");
  const [parsedQuestions, setParsedQuestions] = React.useState<(Question & { core?: CoreType })[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [defaultCore, setDefaultCore] = React.useState<CoreType>("core1");
  const { toast } = useToast();

  // Load saved default core on mount
  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CORE_KEY);
      if (saved === "core1" || saved === "core2") setDefaultCore(saved);
    } catch {}
  }, []);

  // Persist default core whenever it changes
  React.useEffect(() => {
    try {
      window.localStorage.setItem(CORE_KEY, defaultCore);
    } catch {}
  }, [defaultCore]);

  const onParse = async () => {
    if (!text.trim()) {
      toast({
        title: "Error",
        description: "Please paste some question text to parse.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    setParsedQuestions([]);
    try {
      const result = await handleParseQuestions({ text });

      // ⛔️ Ignore any AI-decided core — always use the saved defaultCore for new rows
      const withCore = (result as any[]).map((q) => ({
        ...q,
        core: defaultCore as CoreType,
      })) as (Question & { core?: CoreType })[];

      setParsedQuestions(withCore);
      toast({
        title: "Success",
        description: `Successfully parsed ${withCore.length} question(s). Review and save below.`,
      });
    } catch (error) {
      console.error("Parsing failed:", error);
      toast({
        title: "Parsing Failed",
        description: "Could not parse questions from the provided text. Please check the format.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldChange = (
    index: number,
    field: keyof (Question & { core?: CoreType }),
    value: any
  ) => {
    setParsedQuestions((prev) => {
      const updated = [...prev];
      (updated[index] as any)[field] = value;
      return updated;
    });
  };

  const applyDefaultCoreToAll = () => {
    setParsedQuestions((prev) => prev.map((q) => ({ ...q, core: defaultCore })));
    toast({ title: "Core applied", description: `All rows set to ${defaultCore.toUpperCase()}.` });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save exactly what the user sees; core comes from row or default if missing
      const payload = parsedQuestions.map((q) => ({ ...(q as any), core: (q.core ?? defaultCore) }));
      const result = await handleSaveQuestions(payload as any);
      if (result.success) {
        toast({
          title: "Success!",
          description: `${result.savedQuestions.length} questions have been saved to Firestore.`,
        });
        onQuestionsAdded(result.savedQuestions);
        setParsedQuestions([]);
        setText("");
        setIsOpen(false);
      } else {
        toast({
          title: "Error saving questions",
          description: "There was a problem saving your questions.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error saving to firestore", error);
      toast({
        title: "Error saving questions",
        description: "There was a problem saving your questions. See the console for details.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Helpers for correct answer UI
  const normalize = (s: string) =>
    s.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

  const mcqSelectedIndex = (q: Question): number => {
    if (!q.options?.length) return -1;
    const opts = q.options;
    const ca = q.correctAnswer;
    if (Array.isArray(ca)) {
      const idx = opts.findIndex((o) => ca.includes(o));
      if (idx >= 0) return idx;
      const normIdx = opts.findIndex((o) => ca.map(normalize).includes(normalize(o)));
      return normIdx;
    }
    if (typeof ca === "string" && ca) {
      const letter = ca.trim().toUpperCase();
      if (/^[A-H]$/.test(letter)) return "ABCDEFGH".indexOf(letter);
      const exact = opts.findIndex((o) => o === ca);
      if (exact >= 0) return exact;
      const fuzzy = opts.findIndex((o) => normalize(o) === normalize(ca));
      if (fuzzy >= 0) return fuzzy;
    }
    return -1;
  };

  const toggleCheckboxAnswer = (qIndex: number, optionText: string, checked: boolean) => {
    const q = parsedQuestions[qIndex];
    const current = Array.isArray(q.correctAnswer) ? q.correctAnswer : [];
    const next = checked
      ? Array.from(new Set([...current, optionText]))
      : current.filter((x) => x !== optionText);
    handleFieldChange(qIndex, "correctAnswer", next);
    if (next.length > 1 && q.questionType !== "checkbox") {
      handleFieldChange(qIndex, "questionType", "checkbox");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center gap-2">
            <Wand2 className="text-primary" />
            Paste & Parse Questions
          </DialogTitle>
          <DialogDescription>
            Your selected Core is remembered. Parsing won’t override it. If the correct answer isn’t detected, pick it from the dropdown/checkboxes.
          </DialogDescription>
        </DialogHeader>

        {/* Top controls */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex-1 flex flex-col gap-2">
            <Label htmlFor="paste-area">Raw Question Text</Label>
            <Textarea
              id="paste-area"
              placeholder="Paste questions here..."
              className="min-h-[120px]"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          <div className="md:w-[320px] mt-3 md:mt-7 flex items-center gap-2">
            <Label className="shrink-0">Default Core</Label>
            <Select
              value={defaultCore}
              onValueChange={(v) => setDefaultCore((v as CoreType) ?? "core1")}
            >
              <SelectTrigger><SelectValue placeholder="Select Core" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="core1">Core 1</SelectItem>
                <SelectItem value="core2">Core 2</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={applyDefaultCoreToAll}>
              Apply to all
            </Button>
          </div>
        </div>

        {/* Preview table */}
        <div className="flex-1 overflow-hidden">
          <Label className="mb-2 block">Parsed Questions Preview</Label>
          <ScrollArea className="h-full border border-border rounded-md">
            <Table>
              <TableHeader className="sticky top-0 bg-secondary">
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead>Correct Answer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Core</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedQuestions.map((q, index) => {
                  const hasOptions = Array.isArray(q.options) && q.options.length > 0;
                  const isCheckbox = q.questionType === "checkbox";
                  const selectedIdx = !isCheckbox ? mcqSelectedIndex(q) : -1;

                  return (
                    <TableRow key={index}>
                      <TableCell className="min-w-[280px]">
                        <Input
                          value={q.questionText || ""}
                          onChange={(e) => handleFieldChange(index, "questionText", e.target.value)}
                          className="h-8"
                        />
                      </TableCell>

                      <TableCell className="min-w-[260px]">
                        {hasOptions ? (
                          !isCheckbox ? (
                            <Select
                              value={selectedIdx >= 0 ? String(selectedIdx) : ""}
                              onValueChange={(v) => {
                                const i = parseInt(v, 10);
                                const ans = q.options?.[i];
                                if (ans) handleFieldChange(index, "correctAnswer", ans);
                                if (q.questionType !== "mcq") handleFieldChange(index, "questionType", "mcq");
                              }}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Select the correct answer" />
                              </SelectTrigger>
                              <SelectContent>
                                {q.options!.map((opt, i) => (
                                  <SelectItem key={i} value={String(i)}>
                                    {opt}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {q.options!.map((opt, i) => {
                                const checked = Array.isArray(q.correctAnswer)
                                  ? q.correctAnswer.includes(opt)
                                  : false;
                                return (
                                  <label key={i} className="flex items-center gap-2">
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={(c) => toggleCheckboxAnswer(index, opt, !!(c as boolean))}
                                    />
                                    <span className="text-sm">{opt}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )
                        ) : (
                          <Input
                            placeholder="Type the correct answer"
                            value={
                              Array.isArray(q.correctAnswer)
                                ? q.correctAnswer.join(", ")
                                : (q.correctAnswer as string) || ""
                            }
                            onChange={(e) => handleFieldChange(index, "correctAnswer", e.target.value)}
                            className="h-8"
                          />
                        )}
                      </TableCell>

                      <TableCell className="w-[150px]">
                        <Select
                          value={q.questionType as "mcq" | "checkbox"}
                          onValueChange={(v) => {
                            if (v === "mcq" && Array.isArray(q.correctAnswer)) {
                              handleFieldChange(index, "correctAnswer", q.correctAnswer[0] ?? "");
                            }
                            handleFieldChange(index, "questionType", v);
                          }}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mcq">Multiple Choice</SelectItem>
                            <SelectItem value="checkbox">Checkboxes</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>

                      <TableCell className="w-[140px]">
                        <Select
                          value={(q.difficulty as any) || "medium"}
                          onValueChange={(v) => handleFieldChange(index, "difficulty", v)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Difficulty" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="easy">Easy</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="hard">Hard</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>

                      <TableCell className="w-[140px]">
                        <Select
                          value={(q.core as CoreType) ?? defaultCore}
                          onValueChange={(v) => handleFieldChange(index, "core", (v as CoreType) ?? defaultCore)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="core1">Core 1</SelectItem>
                            <SelectItem value="core2">Core 2</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading && parsedQuestions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
                      Parsed questions will appear here.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={onParse} disabled={isLoading || isSaving}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Parse Text
          </Button>
          <Button onClick={handleSave} disabled={parsedQuestions.length === 0 || isSaving || isLoading}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save to Firestore
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
