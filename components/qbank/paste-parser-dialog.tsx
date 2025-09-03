
"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { handleParseQuestions, handleSaveQuestions } from "@/lib/actions";
import { type ParseQuestionsOutput } from "@/ai/flows/parse-question";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { type Question } from "@/types";

type PasteParserDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onQuestionsAdded: (newQuestions: Question[]) => void;
};

export function PasteParserDialog({ isOpen, setIsOpen, onQuestionsAdded }: PasteParserDialogProps) {
  const [text, setText] = React.useState("");
  const [parsedQuestions, setParsedQuestions] = React.useState<ParseQuestionsOutput>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
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
      const result = await handleParseQuestions({ text });
      setParsedQuestions(result);
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

  const handleFieldChange = (index: number, field: string, value: string | string[]) => {
    const updatedQuestions = [...parsedQuestions];
    (updatedQuestions[index] as any)[field] = value;
    setParsedQuestions(updatedQuestions);
  };
  
  const handleSave = async () => {
      setIsSaving(true);
      try {
        const result = await handleSaveQuestions(parsedQuestions);

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
              variant: "destructive"
          })
        }
      } catch (error) {
          console.error("Error saving to firestore", error)
          toast({
              title: "Error saving questions",
              description: "There was a problem saving your questions. See the console for details.",
              variant: "destructive"
          })
      } finally {
          setIsSaving(false);
      }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center gap-2">
            <Wand2 className="text-primary"/>
            Paste & Parse Questions
          </DialogTitle>
          <DialogDescription>
            Paste a block of exam questions below. The AI will automatically parse them into structured records.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden">
            <div className="flex flex-col gap-2">
                <Label htmlFor="paste-area">Raw Question Text</Label>
                <Textarea
                    id="paste-area"
                    placeholder="Paste questions here... Supports mixed English and Arabic, various numbering formats."
                    className="flex-1 resize-none"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                />
            </div>

            <div className="flex flex-col gap-2 overflow-hidden">
                 <Label>Parsed Questions Preview</Label>
                 <ScrollArea className="flex-1 border border-border rounded-md">
                     <Table>
                         <TableHeader className="sticky top-0 bg-secondary">
                             <TableRow>
                                 <TableHead>Question</TableHead>
                                 <TableHead>Correct Answer</TableHead>
                                 <TableHead>Type</TableHead>
                                 <TableHead>Difficulty</TableHead>
                             </TableRow>
                         </TableHeader>
                         <TableBody>
                             {parsedQuestions.map((q, index) => (
                                 <TableRow key={index}>
                                     <TableCell>
                                         <Input 
                                             value={q.questionText} 
                                             onChange={(e) => handleFieldChange(index, 'questionText', e.target.value)}
                                             className="h-8"
                                         />
                                     </TableCell>
                                      <TableCell>
                                         <Input 
                                             value={Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : (q.correctAnswer || '')}
                                             onChange={(e) => handleFieldChange(index, 'correctAnswer', e.target.value)}
                                             className="h-8 w-40"
                                         />
                                     </TableCell>
                                     <TableCell>
                                         <Input 
                                             value={q.questionType} 
                                             onChange={(e) => handleFieldChange(index, 'questionType', e.target.value)}
                                             className="h-8 w-24"
                                         />
                                     </TableCell>
                                     <TableCell>
                                         <Input 
                                             value={q.difficulty}
                                             onChange={(e) => handleFieldChange(index, 'difficulty', e.target.value)}
                                             className="h-8 w-24"
                                         />
                                     </TableCell>
                                 </TableRow>
                             ))}
                              {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground h-24">
                                        <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                                    </TableCell>
                                </TableRow>
                              )}
                              {!isLoading && parsedQuestions.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground h-24">
                                        Parsed questions will appear here.
                                    </TableCell>
                                </TableRow>
                              )}
                         </TableBody>
                     </Table>
                 </ScrollArea>
            </div>
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

    
