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
import { type ParseQuestionsOutput } from "@/ai/flows/parse-question";
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

type PasteParserDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onQuestionsAdded: (newQuestions: Question[]) => void;
};

type CoreType = "core1" | "core2";

export function PasteParserDialog({ isOpen, setIsOpen, onQuestionsAdded }: PasteParserDialogProps) {
  const [text, setText] = React.useState("");
  const [parsedQuestions, setParsedQuestions] = React.useState<(Question & { core?: CoreType })[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [defaultCore, setDefaultCore] = React.useState<CoreType>("core1"); // 👈 Bulk default
  const { toast } = useToast();

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
      const result = await handleParseQuestions({ text }); // ParseQuestionsOutput
      // أضف core افتراضياً (core1) لكل عنصر — ويمكن تعديلها في الجدول
      const withCore = (result as any[]).map((q) => ({
        ...q,
        core: (q?.core === "core2" ? "core2" : "core1") as CoreType,
      })) as (Question & { core?: CoreType })[];
      setParsedQuestions(withCore);
      toast({
        title: "Success",
        description: `Successfully parsed ${result.length} questions. Review and save below.`,
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

  const handleFieldChange = (index: number, field: keyof (Question & { core?: CoreType }), value: any) => {
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
      // مرّر core مع كل سؤال للحفظ — handleSaveQuestions سيحفظ الحقول كما هي
      // حتى لو نوع Question الحالي ما يعرّف core، ما عندنا مشكلة لأنه يُكتب في Firestore
      const payload = parsedQuestions.map((q) => ({ ...(q as any), core: (q.core ?? defaultCore) }));
      const result = await handleSaveQuestions(payload as unknown as ParseQuestionsOutput);

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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center gap-2">
            <Wand2 className="text-primary" />
            Paste & Parse Questions
          </DialogTitle>
          <DialogDescription>
            Paste a block of exam questions below. The AI will automatically parse them into structured records.
          </DialogDescription>
        </DialogHeader>

        {/* Top controls */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex-1 flex flex-col gap-2">
            <Label htmlFor="paste-area">Raw Question Text</Label>
            <Textarea
              id="paste-area"
              placeholder="Paste questions here... Supports mixed English and Arabic, various numbering formats."
              className="min-h-[120px]"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          <div className="md:w-[280px] mt-3 md:mt-7 flex items-center gap-2">
            <Label className="shrink-0">Default Core</Label>
            <Select value={defaultCore} onValueChange={(v) => setDefaultCore((v as CoreType) ?? "core1")}>
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
                {parsedQuestions.map((q, index) => (
                  <TableRow key={index}>
                    <TableCell className="min-w-[280px]">
                      <Input
                        value={q.questionText || ""}
                        onChange={(e) => handleFieldChange(index, "questionText", e.target.value)}
                        className="h-8"
                      />
                    </TableCell>

                    <TableCell className="min-w-[200px]">
                      <Input
                        value={
                          Array.isArray(q.correctAnswer)
                            ? q.correctAnswer.join(", ")
                            : (q.correctAnswer as string) || ""
                        }
                        onChange={(e) => handleFieldChange(index, "correctAnswer", e.target.value)}
                        className="h-8"
                      />
                    </TableCell>

                    <TableCell className="w-[140px]">
                      <Input
                        value={q.questionType as any}
                        onChange={(e) => handleFieldChange(index, "questionType", e.target.value)}
                        className="h-8"
                      />
                    </TableCell>

                    <TableCell className="w-[120px]">
                      <Input
                        value={q.difficulty as any}
                        onChange={(e) => handleFieldChange(index, "difficulty", e.target.value)}
                        className="h-8"
                      />
                    </TableCell>

                    <TableCell className="w-[140px]">
                      <Select
                        value={(q.core as CoreType) ?? "core1"}
                        onValueChange={(v) => handleFieldChange(index, "core", (v as CoreType) ?? "core1")}
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
                ))}

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
