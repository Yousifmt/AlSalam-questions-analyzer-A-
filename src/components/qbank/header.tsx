
"use client";

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Filter, PlusCircle, Search, X, Sun, Moon, Eye, EyeOff, Loader2, Lock, Unlock, RefreshCcw, FileText, Download, Wand2 } from "lucide-react";
import { PasteParserDialog } from './paste-parser-dialog';
import { type Question } from '@/types';
import { useTheme } from 'next-themes';
import { useLock } from '@/context/lock-context';
import { UnlockDialog } from './unlock-dialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { ExportOptionsDialog } from './export-options-dialog';

type HeaderProps = {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onQuestionsAdded: (newQuestions: Question[]) => void;
  onFilterClick: () => void;
  questionCount: number;
  showAllAnswers: boolean;
  setShowAllAnswers: (show: boolean | ((s:boolean) => boolean)) => void;
  isExamMode: boolean;
  onGenerateExam: () => void;
  onResetView: () => void;
  filteredQuestions: Question[];
};

export default function Header({ 
  searchQuery, 
  setSearchQuery, 
  onQuestionsAdded, 
  onFilterClick, 
  questionCount,
  showAllAnswers, 
  setShowAllAnswers, 
  isExamMode, 
  onGenerateExam, 
  onResetView,
  filteredQuestions,
}: HeaderProps) {
  const [isPasteDialogOpen, setIsPasteDialogOpen] = React.useState(false);
  const [isUnlockDialogOpen, setIsUnlockDialogOpen] = React.useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = React.useState(false);
  const [isToggleLoading, setIsToggleLoading] = React.useState(false);
  const { theme, setTheme } = useTheme();
  const { isLocked } = useLock();
  const [mounted, setMounted] = React.useState(false);
  const { toast } = useToast();
  const router = useRouter();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleToggleAnswers = () => {
      setIsToggleLoading(true);
      setTimeout(() => {
          setShowAllAnswers(prev => !prev);
          setIsToggleLoading(false);
      }, 250); // A short delay to make the loading visible
  }

  const handleExportClick = () => {
    if (filteredQuestions.length === 0) {
      toast({
        title: "No questions to export",
        description: "The current filter has no questions. Please adjust your filters.",
        variant: "destructive"
      });
      return;
    }
    setIsExportDialogOpen(true);
  };

  return (
    <>
      <header className="flex-shrink-0 border-b border-border p-4 flex flex-col md:flex-row items-center justify-between gap-4 bg-background/80 backdrop-blur-sm">
        <h2 className="font-headline text-xl md:text-2xl w-full md:w-auto text-center md:text-left">
            <span className="text-primary font-bold">Al-Salam</span>
            <span className="text-foreground"> Questions Analyzer</span>
        </h2>

        <div className="w-full md:w-auto flex flex-col md:flex-row items-center gap-2 md:gap-4">
          <div className="flex items-center gap-2 w-full">
              <div className="flex flex-col items-center">
                <Button variant="outline" onClick={onFilterClick} size="sm" className="md:w-auto w-fit" disabled={isExamMode}>
                    <Filter className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">Filters</span>
                </Button>
                <span className="text-xs text-foreground/70 md:hidden mt-1">{questionCount} questions</span>
              </div>
              <div className="flex flex-col flex-grow items-start sm:items-center sm:flex-row gap-2">
                  <div className="relative flex-grow w-full">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Search questions..."
                        className="pl-10 pr-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        disabled={isExamMode}
                      />
                      {searchQuery && (
                      <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setSearchQuery("")}
                          disabled={isExamMode}
                      >
                          <X className="h-5 w-5" />
                      </Button>
                      )}
                  </div>
                  <span className={cn("text-xs sm:text-sm text-foreground whitespace-nowrap text-left hidden md:inline-block", { 'font-bold text-primary': isExamMode })}>
                      {isExamMode ? 'Exam Mode' : `${questionCount} ${questionCount === 1 ? 'question' : 'questions'}`}
                  </span>
              </div>
          </div>
          
          <div className="flex items-center gap-1 md:gap-2 self-end md:self-center">
              {isExamMode ? (
                   <Button onClick={onResetView} variant="destructive" size="sm">
                      <RefreshCcw className="h-4 w-4 md:mr-2" />
                      <span className="hidden md:inline">Reset View</span>
                      <span className="md:hidden">Reset</span>
                  </Button>
              ) : (
                <Button onClick={onGenerateExam} className="font-semibold" size="sm">
                    <FileText className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">Generate Exam</span>
                    <span className="md:hidden">Exam</span>
                </Button>
              )}

              {!isLocked && !isExamMode && (
                <>
                  <Button onClick={() => setIsPasteDialogOpen(true)} className="font-semibold" size="sm">
                      <PlusCircle className="h-4 w-4 md:mr-2" />
                      <span className="hidden md:inline">Add Questions</span>
                      <span className="md:hidden">Add</span>
                  </Button>
                   <Button onClick={handleExportClick} variant="outline" size="sm">
                      <Download className="h-4 w-4 md:mr-2" />
                      <span>Export</span>
                  </Button>
                  <Button onClick={() => router.push('/categorize')} variant="outline" size="sm">
                      <Wand2 className="h-4 w-4 md:mr-2" />
                      <span>Batch Categorize</span>
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={handleToggleAnswers} disabled={isToggleLoading || isExamMode}>
                  {isToggleLoading ? (
                      <Loader2 className="h-4 w-4 md:mr-2 animate-spin" />
                  ) : showAllAnswers ? (
                      <EyeOff className="h-4 w-4 md:mr-2" />
                  ) : (
                      <Eye className="h-4 w-4 md:mr-2" />
                  )}
                  <span>
                      {showAllAnswers ? 'Hide Answers' : 'Show Answers'}
                  </span>
              </Button>
              <Button variant="outline" size="sm" className="w-auto" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {mounted && theme === 'dark' ? <Sun className="h-[1.2rem] w-[1.2rem]" /> : <Moon className="h-[1.2rem] w-[1.2rem]" />}
                <span className="ml-2">{mounted ? (theme === 'dark' ? 'Light' : 'Dark') : '...'}</span>
              </Button>
              <Button variant="outline" size="icon" className="w-9 h-9" onClick={() => setIsUnlockDialogOpen(true)}>
                  {isLocked ? <Lock /> : <Unlock />}
                  <span className="sr-only">Toggle Lock</span>
              </Button>
          </div>
        </div>
      </header>
      
      <PasteParserDialog isOpen={isPasteDialogOpen} setIsOpen={setIsPasteDialogOpen} onQuestionsAdded={onQuestionsAdded} />
      <UnlockDialog isOpen={isUnlockDialogOpen} setIsOpen={setIsUnlockDialogOpen} />
      <ExportOptionsDialog 
        isOpen={isExportDialogOpen} 
        setIsOpen={setIsExportDialogOpen} 
        questions={filteredQuestions} 
      />
    </>
  );
}
