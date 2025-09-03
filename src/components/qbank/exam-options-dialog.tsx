
"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { type ExamMode } from "@/app/page";
import { FileText } from "lucide-react";


type ExamOptionsDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onStartExam: (mode: ExamMode) => void;
};

export function ExamOptionsDialog({ isOpen, setIsOpen, onStartExam }: ExamOptionsDialogProps) {
  const [mode, setMode] = React.useState<ExamMode>("during");

  const handleStart = () => {
      onStartExam(mode);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center gap-2">
            <FileText className="text-primary"/>
            Exam Options
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            This exam simulates the final exam which will have 90 questions randomized. Choose how you want to see the correct answers.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
            <RadioGroup value={mode} onValueChange={(value: ExamMode) => setMode(value)}>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="during" id="during" />
                    <Label htmlFor="during">Show answers during the exam</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="after" id="after" />
                    <Label htmlFor="after">Show answers only after finishing</Label>
                </div>
            </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleStart}>
            Start Exam
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    
