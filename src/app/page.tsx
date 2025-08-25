
"use client";

import * as React from "react";
import { type Question } from "@/types";
import Header from "@/components/qbank/header";
import QuestionList from "@/components/qbank/question-list";
import { ExplanationPanel } from "@/components/qbank/explanation-panel";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import FilterSheet from "@/components/qbank/filter-sheet";
import { LockProvider } from "@/context/lock-context";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { BackToTopButton } from "@/components/qbank/back-to-top";
import { ExamOptionsDialog } from "@/components/qbank/exam-options-dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from "@/components/ui/alert-dialog";
import Footer from "@/components/qbank/footer";

const EXAM_QUESTION_COUNT = 90;

export type ExamMode = "during" | "after";

export default function Home() {
  const [questions, setQuestions] = React.useState<Question[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [filteredQuestions, setFilteredQuestions] = React.useState<Question[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filters, setFilters] = React.useState({
    chapter: [] as string[],
    questionType: [] as string[],
    showSavedOnly: false,
    quiz: 'all',
  });
  const [sort, setSort] = React.useState("chapter_asc");
  const [showAllAnswers, setShowAllAnswers] = React.useState(false);
  const [userAnswers, setUserAnswers] = React.useState<Record<string, string | string[]>>({});

  const [isExplanationPanelOpen, setIsExplanationPanelOpen] = React.useState(false);
  const [selectedQuestionForExplanation, setSelectedQuestionForExplanation] = React.useState<Question | null>(null);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = React.useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = React.useState(true);
  
  // Exam State
  const [isExamMode, setIsExamMode] = React.useState(false);
  const [isExamOptionsDialogOpen, setIsExamOptionsDialogOpen] = React.useState(false);
  const [examAnswerMode, setExamAnswerMode] = React.useState<ExamMode>("during");
  const [isExamFinished, setIsExamFinished] = React.useState(false);
  const [examScore, setExamScore] = React.useState(0);
  const [isResultsDialogOpen, setIsResultsDialogOpen] = React.useState(false);


  const isMobile = useIsMobile();
  
  const [showBackToTop, setShowBackToTop] = React.useState(false);
  const pageRef = React.useRef<HTMLDivElement>(null);

  const [savedQuestionIds, setSavedQuestionIds] = React.useState<string[]>([]);

  const fetchQuestions = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const questionsCollection = collection(db, 'questions');
      const q = query(questionsCollection, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const questionsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
      
      setQuestions(questionsData);
    } catch (error) {
      console.error("Error fetching questions: ", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const allChapters = React.useMemo(() => {
    const chapters = new Set<string>();
    questions.forEach(q => q.chapter && chapters.add(q.chapter));
    
    const getChapterNumber = (chapterString: string) => {
      const match = chapterString.match(/Chapter (\d+)/);
      return match ? parseInt(match[1], 10) : Infinity;
    };

    return Array.from(chapters).sort((a,b) => getChapterNumber(a) - getChapterNumber(b));
}, [questions]);


  React.useEffect(() => {
    if (isExamMode) {
      // In exam mode, we don't apply filters or sorting. The questions are already set.
      return;
    }

    let tempQuestions = [...questions];

    const getChapterNumber = (chapterString: string) => {
        const match = chapterString.match(/Chapter (\d+)/);
        return match ? parseInt(match[1], 10) : Infinity;
    }

    // Always sort by chapter first for quiz slicing
    const chapterSortedQuestions = [...tempQuestions].sort((a, b) => getChapterNumber(a.chapter) - getChapterNumber(b.chapter));

    // Apply quiz filter first
    if (filters.quiz !== 'all') {
      const quizNumber = parseInt(filters.quiz.replace('quiz', ''), 10);
      const startIndex = (quizNumber - 1) * 100;
      if (quizNumber === 6) {
        tempQuestions = chapterSortedQuestions.slice(startIndex); // 500 to end
      } else {
        const endIndex = startIndex + 100;
        tempQuestions = chapterSortedQuestions.slice(startIndex, endIndex);
      }
    } else {
      tempQuestions = chapterSortedQuestions;
    }

    if (searchQuery) {
      tempQuestions = tempQuestions.filter((q) =>
        q.questionText.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (filters.showSavedOnly) {
      tempQuestions = tempQuestions.filter((q) => savedQuestionIds.includes(q.id));
    }

    if (filters.chapter.length > 0) {
        tempQuestions = tempQuestions.filter((q) => filters.chapter.includes(q.chapter));
    }
    if (filters.questionType.length > 0) {
      tempQuestions = tempQuestions.filter((q) => filters.questionType.includes(q.questionType));
    }
    
    // The main sort logic is applied after all filters
    const sortedQuestions = [...tempQuestions].sort((a, b) => {
        switch(sort) {
            case 'chapter_desc':
                return getChapterNumber(b.chapter) - getChapterNumber(a.chapter);
            case 'random':
                return Math.random() - 0.5;
            case 'chapter_asc':
            default:
                // This will maintain the chapter sort unless another sort is selected
                return 0; 
        }
    });

    setFilteredQuestions(sortedQuestions);
    setUserAnswers({}); // Reset answers when filters change
  }, [searchQuery, filters, questions, sort, isExamMode, savedQuestionIds]);

  React.useEffect(() => {
    const onWinScroll = () => setShowBackToTop(window.scrollY > 200);
    window.addEventListener("scroll", onWinScroll, { passive: true });
    return () => window.removeEventListener("scroll", onWinScroll);
  }, []);
  
  const handleExplainClick = (question: Question) => {
    setSelectedQuestionForExplanation(question);
    setIsExplanationPanelOpen(true);
  };

  const startExam = (mode: ExamMode) => {
    const shuffled = [...questions].sort(() => 0.5 - Math.random());
    const examQuestions = shuffled.slice(0, EXAM_QUESTION_COUNT);
    setFilteredQuestions(examQuestions);
    
    setIsExamMode(true);
    setExamAnswerMode(mode);
    setIsExamFinished(false);
    setUserAnswers({});
    setExamScore(0);
    setShowAllAnswers(false);

    // Reset other filters to avoid confusion
    setSearchQuery("");
    setFilters({ chapter: [], questionType: [], showSavedOnly: false, quiz: 'all' });
    setSort('chapter_asc'); 
    setIsExamOptionsDialogOpen(false);
  };

  const handleAnswerChange = (questionId: string, answer: string | string[]) => {
    setUserAnswers(prev => ({...prev, [questionId]: answer}));
  };

  const submitExam = () => {
    let score = 0;
    filteredQuestions.forEach(q => {
      const userAnswer = userAnswers[q.id];
      if (!userAnswer) return;

      if (Array.isArray(q.correctAnswer)) {
        if (Array.isArray(userAnswer) && userAnswer.length === q.correctAnswer.length) {
          const sortedUserAnswers = [...userAnswer].sort();
          const sortedCorrectAnswers = [...q.correctAnswer].sort();
          if (sortedUserAnswers.every((val, index) => val === sortedCorrectAnswers[index])) {
            score++;
          }
        }
      } else {
        if (userAnswer === q.correctAnswer) {
          score++;
        }
      }
    });
    setExamScore(score);
    setIsExamFinished(true);
    setShowAllAnswers(true); // Show all correct answers for review
    setIsResultsDialogOpen(true);
  };


  const resetView = () => {
    setIsExamMode(false);
    setIsExamFinished(false);
    setUserAnswers({});
    setExamScore(0);
    // The useEffect will automatically re-apply filters and sorting
  };

  const handleQuestionsAdded = (newQuestions: Question[]) => {
    const combinedQuestions = [...questions];
    newQuestions.forEach(newQ => {
        const index = combinedQuestions.findIndex(q => q.id === newQ.id);
        if (index !== -1) {
            combinedQuestions[index] = newQ;
        } else {
            combinedQuestions.push(newQ);
        }
    });

    combinedQuestions.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setQuestions(combinedQuestions);
}

  const handleQuestionDeleted = (questionId: string) => {
    const updatedQuestions = questions.filter(q => q.id !== questionId);
    setQuestions(updatedQuestions);
  }

  const handleQuestionUpdated = (updatedQuestion: Question) => {
    const updatedQuestions = questions.map(q => q.id === updatedQuestion.id ? updatedQuestion : q);
    setQuestions(updatedQuestions);
  }

  const toggleSaveQuestion = (questionId: string) => {
    setSavedQuestionIds(prev =>
      prev.includes(questionId)
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId]
    );
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };


  return (
    <LockProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground" ref={pageRef}>
        <FilterSheet
            isOpen={isFilterSheetOpen}
            setIsOpen={setIsFilterSheetOpen}
            filters={filters}
            setFilters={setFilters}
            chapters={allChapters}
            sort={sort}
            setSort={setSort}
            disabled={isExamMode}
          />
        <div className="flex-1 flex flex-col">
          <div className="sticky top-0 z-30">
            <div className={cn("transition-all duration-300 ease-in-out relative", 
                isMobile && !isHeaderVisible ? "h-0 overflow-hidden" : "h-auto"
              )}>
                <Header 
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  onQuestionsAdded={handleQuestionsAdded}
                  onFilterClick={() => setIsFilterSheetOpen(true)}
                  questionCount={filteredQuestions.length}
                  showAllAnswers={showAllAnswers}
                  setShowAllAnswers={setShowAllAnswers}
                  isExamMode={isExamMode}
                  onGenerateExam={() => setIsExamOptionsDialogOpen(true)}
                  onResetView={resetView}
                  filteredQuestions={filteredQuestions}
                />
                {isMobile && (
                  <Button
                    variant="outline"
                    size="icon"
                    className={cn("absolute right-4 -bottom-4 z-20 rounded-full h-8 w-8 border-2 border-background")}
                    onClick={() => setIsHeaderVisible(prev => !prev)}
                  >
                    <ChevronUp className="h-4 w-4" />
                    <span className="sr-only">Toggle Header</span>
                  </Button>
                )}
              </div>
              {isMobile && !isHeaderVisible && (
                <Button
                  variant="outline"
                  size="icon"
                  className={cn("absolute right-4 top-2 z-20 rounded-full h-8 w-8 border-2 border-background")}
                  onClick={() => setIsHeaderVisible(prev => !prev)}
                >
                  <ChevronDown className="h-4 w-4" />
                  <span className="sr-only">Toggle Header</span>
                </Button>
              )}
          </div>
          <main className="flex-1">
            {isLoading ? (
              <div className="p-4 space-y-4 max-w-full lg:max-w-screen-lg mx-auto">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <QuestionList 
                questions={filteredQuestions} 
                allQuestions={questions}
                onExplainClick={handleExplainClick}
                onDelete={handleQuestionDeleted}
                onUpdate={handleQuestionUpdated}
                showAllAnswers={showAllAnswers}
                isExamMode={isExamMode}
                savedQuestionIds={savedQuestionIds}
                onToggleSave={toggleSaveQuestion}
                onAnswerChange={handleAnswerChange}
                examAnswerMode={examAnswerMode}
                isExamFinished={isExamFinished}
                userAnswers={userAnswers}
                onSubmitExam={submitExam}
              />
            )}
          </main>
          <Footer />
        </div>
        
        {selectedQuestionForExplanation && (
          <ExplanationPanel
            isOpen={isExplanationPanelOpen}
            setIsOpen={setIsExplanationPanelOpen}
            question={selectedQuestionForExplanation}
          />
        )}
        {showBackToTop && <BackToTopButton onClick={scrollToTop} />}

        <ExamOptionsDialog
          isOpen={isExamOptionsDialogOpen}
          setIsOpen={setIsExamOptionsDialogOpen}
          onStartExam={startExam}
        />

        <AlertDialog open={isResultsDialogOpen} onOpenChange={setIsResultsDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Exam Finished!</AlertDialogTitle>
                    <AlertDialogDescription className="text-gray-500 dark:text-gray-400">
                        You have completed the exam. Here is your score.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4 text-center text-4xl font-bold">
                    {examScore} / {EXAM_QUESTION_COUNT}
                </div>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={() => setIsResultsDialogOpen(false)}>Review Answers</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </div>
    </LockProvider>
  );
}
