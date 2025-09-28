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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import Footer from "@/components/qbank/footer";

const EXAM_QUESTION_COUNT = 90;

// 🔹 one source of truth for “recent”
const RECENT_DAYS = 10;

export type ExamMode = "during" | "after";
export type SortType = "chapter_asc" | "chapter_desc" | "random";

const initialFilters = {
  chapter: [] as string[],
  questionType: [] as string[],
  showSavedOnly: false,
  quiz: "all",
  recentOnly: false,
};

// Normalize createdAt to JS Date (supports Firestore Timestamp or string/date)
const getCreatedAtDate = (val: any): Date | null => {
  if (!val) return null;
  if (typeof val?.toDate === "function") {
    try {
      return val.toDate();
    } catch {
      /* noop */
    }
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

export default function Home() {
  const [questions, setQuestions] = React.useState<Question[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [filteredQuestions, setFilteredQuestions] = React.useState<Question[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filters, setFilters] = React.useState(initialFilters);
  const [sort, setSort] = React.useState<SortType>("chapter_asc");
  const [showAllAnswers, setShowAllAnswers] = React.useState(false);
  const [userAnswers, setUserAnswers] = React.useState<Record<string, string | string[]>>({});

  const [isExplanationPanelOpen, setIsExplanationPanelOpen] = React.useState(false);
  const [selectedQuestionForExplanation, setSelectedQuestionForExplanation] =
    React.useState<Question | null>(null);
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

  // Fetch questions from Firestore
  const fetchQuestions = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const questionsCollection = collection(db, "questions");
      const q = query(questionsCollection, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const questionsData = querySnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Question)
      );
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

  // Get all chapters sorted numerically
  const allChapters = React.useMemo(() => {
    const chapters = new Set<string>();
    questions.forEach((q) => q.chapter && chapters.add(q.chapter));

    const getChapterNumber = (chapterString: string) => {
      const match = chapterString?.match?.(/Chapter (\d+)/);
      return match ? parseInt(match[1], 10) : Infinity;
    };

    return Array.from(chapters).sort((a, b) => getChapterNumber(a) - getChapterNumber(b));
  }, [questions]);

  // Apply filters, search, and sorting
  React.useEffect(() => {
    if (isExamMode) return; // Skip filtering during exam mode

    let tempQuestions = [...questions];

    const getChapterNumber = (chapterString: string) => {
      const match = chapterString?.match?.(/Chapter (\d+)/);
      return match ? parseInt(match[1], 10) : Infinity;
    };

    // 1) Sort by chapter for quiz slicing
    const chapterSortedQuestions = [...tempQuestions].sort(
      (a, b) => getChapterNumber(a.chapter) - getChapterNumber(b.chapter)
    );

    // 2) Apply quiz filter (45 per quiz 1-5, quiz 6 = remaining)
    if (filters.quiz !== "all") {
      const quizNumber = parseInt(filters.quiz.replace("quiz", ""), 10);
      if (quizNumber >= 1 && quizNumber <= 6) {
        const QUIZ_SIZE = 45;
        let startIndex = 0;
        let endIndex = chapterSortedQuestions.length;

        if (quizNumber >= 1 && quizNumber <= 5) {
          startIndex = (quizNumber - 1) * QUIZ_SIZE; // 0,45,90,135,180
          endIndex = Math.min(startIndex + QUIZ_SIZE, chapterSortedQuestions.length);
        } else if (quizNumber === 6) {
          startIndex = 5 * QUIZ_SIZE; // 225
          endIndex = chapterSortedQuestions.length; // remaining (45 or more)
        }

        // Guard against negative/overflow indices
        startIndex = Math.max(0, Math.min(startIndex, chapterSortedQuestions.length));
        endIndex = Math.max(startIndex, Math.min(endIndex, chapterSortedQuestions.length));

        tempQuestions = chapterSortedQuestions.slice(startIndex, endIndex);
      } else {
        tempQuestions = chapterSortedQuestions;
      }
    } else {
      tempQuestions = chapterSortedQuestions;
    }

    // 3) Filter recentOnly (last 10 days)
    if (filters.recentOnly) {
      const cutoff = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);
      tempQuestions = tempQuestions.filter((q) => {
        const d = getCreatedAtDate((q as any).createdAt);
        return d ? d >= cutoff : false;
      });
    }

    // 4) Search query
    if (searchQuery) {
      const sq = searchQuery.toLowerCase();
      tempQuestions = tempQuestions.filter((q) => q.questionText?.toLowerCase().includes(sq));
    }

    // 5) Saved only
    if (filters.showSavedOnly) {
      tempQuestions = tempQuestions.filter((q) => savedQuestionIds.includes(q.id));
    }

    // 6) Chapter & Type filters
    if (filters.chapter.length > 0) {
      tempQuestions = tempQuestions.filter((q) => filters.chapter.includes(q.chapter));
    }
    if (filters.questionType.length > 0) {
      tempQuestions = tempQuestions.filter((q) => filters.questionType.includes(q.questionType));
    }

    // 7) Final sorting
    const sortedQuestions = [...tempQuestions].sort((a, b) => {
      switch (sort) {
        case "chapter_desc":
          return getChapterNumber(b.chapter) - getChapterNumber(a.chapter);
        case "random":
          return Math.random() - 0.5;
        case "chapter_asc":
        default:
          return 0; // keep current order
      }
    });

    setFilteredQuestions(sortedQuestions);
    setUserAnswers({}); // Reset answers when filters change
  }, [searchQuery, filters, questions, sort, isExamMode, savedQuestionIds]);

  // Scroll listener for back-to-top button
  React.useEffect(() => {
    const onWinScroll = () => setShowBackToTop(window.scrollY > 200);
    window.addEventListener("scroll", onWinScroll, { passive: true });
    return () => window.removeEventListener("scroll", onWinScroll);
  }, []);

  const handleExplainClick = (question: Question) => {
    setSelectedQuestionForExplanation(question);
    setIsExplanationPanelOpen(true);
  };

  // Exam handlers
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

    setSearchQuery("");
    setFilters({ ...initialFilters });
    setSort("chapter_asc");
    setIsExamOptionsDialogOpen(false);
  };

  const handleAnswerChange = (questionId: string, answer: string | string[]) => {
    setUserAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const submitExam = () => {
    let score = 0;
    filteredQuestions.forEach((q) => {
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
        if (userAnswer === q.correctAnswer) score++;
      }
    });
    setExamScore(score);
    setIsExamFinished(true);
    setShowAllAnswers(true);
    setIsResultsDialogOpen(true);
  };

  const resetView = () => {
    setIsExamMode(false);
    setIsExamFinished(false);
    setUserAnswers({});
    setExamScore(0);
  };

  const handleQuestionsAdded = (newQuestions: Question[]) => {
    const combinedQuestions = [...questions];
    newQuestions.forEach((newQ) => {
      const index = combinedQuestions.findIndex((q) => q.id === newQ.id);
      if (index !== -1) {
        combinedQuestions[index] = newQ;
      } else {
        combinedQuestions.push(newQ);
      }
    });

    combinedQuestions.sort(
      (a: any, b: any) =>
        (getCreatedAtDate(b?.createdAt)?.getTime() ?? 0) -
        (getCreatedAtDate(a?.createdAt)?.getTime() ?? 0)
    );
    setQuestions(combinedQuestions);
  };

  const handleQuestionDeleted = (questionId: string) => {
    setQuestions(questions.filter((q) => q.id !== questionId));
  };

  const handleQuestionUpdated = (updatedQuestion: Question) => {
    setQuestions(questions.map((q) => (q.id === updatedQuestion.id ? updatedQuestion : q)));
  };

  const toggleSaveQuestion = (questionId: string) => {
    setSavedQuestionIds((prev) =>
      prev.includes(questionId) ? prev.filter((id) => id !== questionId) : [...prev, questionId]
    );
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const clearAllFilters = () => {
    setFilters({ ...initialFilters });
    setSort("chapter_asc");
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
          onClearAll={clearAllFilters}
        />

        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="sticky top-0 z-30">
            <div
              className={cn(
                "transition-all duration-300 ease-in-out relative",
                isMobile && !isHeaderVisible ? "h-0 overflow-hidden" : "h-auto"
              )}
            >
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
                  className={cn(
                    "absolute right-4 -bottom-4 z-20 rounded-full h-8 w-8 border-2 border-background"
                  )}
                  onClick={() => setIsHeaderVisible((prev) => !prev)}
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
                className={cn(
                  "absolute right-4 top-2 z-20 rounded-full h-8 w-8 border-2 border-background"
                )}
                onClick={() => setIsHeaderVisible((prev) => !prev)}
              >
                <ChevronDown className="h-4 w-4" />
                <span className="sr-only">Toggle Header</span>
              </Button>
            )}
          </div>

          {/* Main Content */}
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

        {/* Side Panels */}
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

        {/* Exam Results Dialog */}
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
              <AlertDialogAction onClick={() => setIsResultsDialogOpen(false)}>
                Review Answers
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </LockProvider>
  );
}
