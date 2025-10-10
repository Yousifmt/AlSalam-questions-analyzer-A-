"use client";

import * as React from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { handleUpdateQuestion } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, PlusCircle, UploadCloud } from "lucide-react";
import { Label } from "@/components/ui/label";
import { type Question } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Checkbox } from "../ui/checkbox";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { app } from "@/lib/firebase";

type EditQuestionDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  question: Question | null;
  onQuestionUpdated: (question: Question) => void;
};

// client-side image upload
async function uploadQuestionImage(questionId: string, file: File): Promise<string> {
  if (!file) throw new Error("No file provided for upload.");
  if (!questionId) throw new Error("Question ID is required for image upload.");

  const storage = getStorage(app);
  const filePath = `question-images/${questionId}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, filePath);

  const snapshot = await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(snapshot.ref);
  return downloadURL;
}

// ✨ ملاحظة: نوع Question عندك قد لا يحتوي "core".
// هنا نخزن "core" محليًا، ونمرّره مع الحفظ كحقل إضافي.
type CoreType = "core1" | "core2";

export function EditQuestionDialog({
  isOpen,
  setIsOpen,
  question,
  onQuestionUpdated,
}: EditQuestionDialogProps) {
  const [editedQuestion, setEditedQuestion] = React.useState<Question | null>(question);
  const [core, setCore] = React.useState<CoreType>("core1"); // ← جديد
  const [isSaving, setIsSaving] = React.useState(false);
  const [selectedImageFile, setSelectedImageFile] = React.useState<File | null>(null);
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const { toast } = useToast();
  const imageInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setEditedQuestion(question);
    setImagePreview(question?.imageUrl || null);
    setSelectedImageFile(null);
    // خذ قيمة core إن كانت موجودة، وإلا اعتبرها core1
    const qCore = (question as any)?.core as CoreType | undefined;
    setCore(qCore === "core2" ? "core2" : "core1");
  }, [question]);

  if (!editedQuestion) return null;

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleFieldChange = (field: keyof Question, value: string | string[]) => {
    setEditedQuestion((prev) => (prev ? { ...prev, [field]: value } : null));
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...(editedQuestion.options || [])];
    newOptions[index] = value;
    handleFieldChange("options", newOptions);
  };

  const handleAddOption = () => {
    const newOptions = [...(editedQuestion.options || []), ""];
    handleFieldChange("options", newOptions);
  };

  const handleRemoveOption = (index: number) => {
    if (!editedQuestion?.options) return;
    const newOptions = [...editedQuestion.options];
    const removedOption = newOptions[index];
    newOptions.splice(index, 1);

    if (editedQuestion.questionType === "mcq") {
      if (editedQuestion.correctAnswer === removedOption) {
        handleFieldChange("correctAnswer", "");
      }
    } else if (
      editedQuestion.questionType === "checkbox" &&
      Array.isArray(editedQuestion.correctAnswer)
    ) {
      const newCorrectAnswers = editedQuestion.correctAnswer.filter((ans) => ans !== removedOption);
      handleFieldChange("correctAnswer", newCorrectAnswers);
    }

    handleFieldChange("options", newOptions);
  };

  const handleCorrectCheckboxChange = (option: string, checked: boolean) => {
    let current = ((editedQuestion.correctAnswer as string[]) || []).slice();
    current = checked ? [...current, option] : current.filter((a) => a !== option);
    handleFieldChange("correctAnswer", current);
  };

  const handleSave = async () => {
    if (!editedQuestion) return;
    setIsSaving(true);
    try {
      if (!editedQuestion.id) throw new Error("Question ID is missing. Cannot update.");

      let finalQuestion: any = { ...editedQuestion, core }; // ← أضفنا core هنا

      if (selectedImageFile) {
        const url = await uploadQuestionImage(editedQuestion.id, selectedImageFile);
        finalQuestion.imageUrl = url;
      }

      // لو نوع Question ما يقبل core تايب سكربتياً، نمرره كـ any
      const result = await handleUpdateQuestion(finalQuestion as Question);

      if (result.success) {
        toast({ title: "Success!", description: "Question has been updated." });
        // رجّع الـ core مع العنصر المحدث حتى ينعكس في الواجهة
        onQuestionUpdated(finalQuestion as Question);
        setIsOpen(false);
      } else {
        throw new Error("There was a problem updating the question in the database.");
      }
    } catch (error) {
      console.error("[Save Process Error]", error);
      const msg = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({ title: "Error", description: `Failed to save changes. ${msg}`, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const renderCorrectAnswerControl = () => {
    if (editedQuestion.questionType === "mcq" && editedQuestion.options) {
      return (
        <div className="space-y-2">
          <Label>Correct Answer</Label>
          <RadioGroup
            value={(editedQuestion.correctAnswer as string) || ""}
            onValueChange={(val) => handleFieldChange("correctAnswer", val)}
          >
            {editedQuestion.options.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`edit-option-${index}`} />
                <Label htmlFor={`edit-option-${index}`}>{option}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      );
    }
    if (editedQuestion.questionType === "checkbox" && editedQuestion.options) {
      return (
        <div className="space-y-2">
          <Label>Correct Answer(s)</Label>
          {editedQuestion.options.map((option, index) => (
            <div key={index} className="flex items-center space-x-2">
              <Checkbox
                id={`edit-check-option-${index}`}
                checked={((editedQuestion.correctAnswer as string[]) || []).includes(option)}
                onCheckedChange={(checked) => handleCorrectCheckboxChange(option, !!checked)}
              />
              <Label htmlFor={`edit-check-option-${index}`}>{option}</Label>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <Label htmlFor="correct-answer">Correct Answer</Label>
        <Input
  id="correct-answer"
  value={(editedQuestion.correctAnswer as string) || ""}
  onChange={(e) => handleFieldChange("correctAnswer", e.target.value)}
/>

      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-3xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">Edit Question</DialogTitle>
          <DialogDescription>Make changes to the question details below and save.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-6">
          <div className="space-y-4">
            {/* Image */}
            <div className="space-y-2">
              <Label>Question Image (Optional)</Label>
              <div
                className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md cursor-pointer hover:border-primary"
                onClick={() => imageInputRef.current?.click()}
              >
                <div className="space-y-1 text-center">
                  {imagePreview ? (
                    <Image
                      src={imagePreview}
                      alt="Question preview"
                      width={200}
                      height={150}
                      className="mx-auto h-24 w-auto rounded-md object-contain"
                    />
                  ) : (
                    <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
                  )}
                  <div className="flex text-sm text-muted-foreground">
                    <span className="relative rounded-md font-medium text-primary focus-within:outline-none">
                      <span>{selectedImageFile ? "Change file" : "Upload a file"}</span>
                      <Input
                        ref={imageInputRef}
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        className="sr-only"
                        onChange={handleImageFileChange}
                        accept="image/*"
                      />
                    </span>
                    <p className="pl-1">
                      {selectedImageFile ? `(${selectedImageFile.name})` : "or drag and drop"}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 10MB</p>
                </div>
              </div>
            </div>

            {/* Question text */}
            <div className="space-y-2">
              <Label htmlFor="question-text">Question Text</Label>
              <Textarea
                id="question-text"
                value={editedQuestion.questionText}
                onChange={(e) => handleFieldChange("questionText", e.target.value)}
                className="min-h-[120px]"
              />
            </div>

            {/* Subject / Chapter */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={editedQuestion.subject}
                  onChange={(e) => handleFieldChange("subject", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="chapter">Chapter</Label>
                <Input
                  id="chapter"
                  value={editedQuestion.chapter}
                  onChange={(e) => handleFieldChange("chapter", e.target.value)}
                />
              </div>
            </div>

            {/* Core (NEW) */}
            <div className="space-y-2">
              <Label>Core</Label>
              <Select
                value={core}
                onValueChange={(val) => setCore((val as CoreType) ?? "core1")}
              >
                <SelectTrigger><SelectValue placeholder="Select Core" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="core1">Core 1</SelectItem>
                  <SelectItem value="core2">Core 2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Type / Difficulty */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Question Type</Label>
                <Select
                  value={editedQuestion.questionType}
                  onValueChange={(val) => {
                    if (val === "checkbox") {
                      const arr = Array.isArray(editedQuestion.correctAnswer)
                        ? editedQuestion.correctAnswer
                        : [editedQuestion.correctAnswer as string].filter(Boolean);
                      handleFieldChange("correctAnswer", arr);
                    } else if (val === "mcq") {
                      const single = Array.isArray(editedQuestion.correctAnswer)
                        ? editedQuestion.correctAnswer[0] || ""
                        : (editedQuestion.correctAnswer as string);
                      handleFieldChange("correctAnswer", single);
                    }
                    handleFieldChange("questionType", val as "mcq" | "checkbox");
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mcq">Multiple Choice</SelectItem>
                    <SelectItem value="checkbox">Checkboxes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select
                  value={editedQuestion.difficulty}
                  onValueChange={(val) => handleFieldChange("difficulty", val)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Options */}
            {["mcq", "checkbox"].includes(editedQuestion.questionType) && (
              <div className="space-y-2">
                <Label>Options</Label>
                <div className="space-y-2">
                  {editedQuestion.options?.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input value={option} onChange={(e) => handleOptionChange(index, e.target.value)} />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveOption(index)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={handleAddOption}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Option
                  </Button>
                </div>
              </div>
            )}

            {/* Correct answer control */}
            {renderCorrectAnswerControl()}

            {/* Explanation */}
            <div className="space-y-2">
              <Label htmlFor="explanation">Explanation</Label>
              <Textarea
                id="explanation"
                value={editedQuestion.explanation || ""}
                onChange={(e) => handleFieldChange("explanation", e.target.value)}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
