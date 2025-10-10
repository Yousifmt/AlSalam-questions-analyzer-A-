// src/app/page.tsx
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
const RECENT_DAYS = 10;

export type ExamMode = "during" | "after";
export type SortType = "chapter_asc" | "chapter_desc" | "random";
export type CoreType = "core1" | "core2";

const initialFilters = {
  chapter: [] as string[],
  questionType: [] as string[],
  showSavedOnly: false,
  quiz: "all",
  recentOnly: false,
};

const getCreatedAtDate = (val: any): Date | null => {
  if (!val) return null;
  if (typeof val?.toDate === "function") {
    try {
      return val.toDate();
    } catch {}
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

/** Core Select Dialog
 * - First open (showClose=false): no X, no overlay close, Esc disabled.
 * - Later opens (showClose=true): shows X, overlay click & Esc close enabled.
 * - Always centered, mobile friendly, safe-area padding.
 */
function CoreSelectDialog({
  isOpen,
  onChoose,
  onClose,
  showClose,
}: {
  isOpen: boolean;
  onChoose: (core: CoreType) => void;
  onClose: () => void;
  showClose: boolean;
}) {
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showClose) onClose();
    };
    document.addEventListener("keydown", onKey);

    // Prevent background scroll while open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose, showClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[999] bg-black/60"
        onClick={showClose ? onClose : undefined}
      />
      {/* Dialog */}
      <div
        className="
          fixed z-[1000] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
          w-[min(92vw,420px)] max-h-[80vh]
          rounded-2xl border border-white/10 bg-[#0f1642] text-white shadow-2xl
          px-[max(1rem,env(safe-area-inset-left))] py-4
        "
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="core-dialog-title"
        aria-describedby="core-dialog-desc"
      >
        <div className="relative">
          <h2 id="core-dialog-title" className="text-lg font-semibold">
            Select Core
          </h2>
          <p id="core-dialog-desc" className="mt-1 text-sm text-white/70">
            Choose which question set you want to view.
          </p>

          {/* Close button appears only on later opens */}
          {showClose && (
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="absolute right-0 top-0 inline-flex h-8 w-8 items-center justify-center rounded-full
                         bg-white/10 text-white hover:bg-red-500 focus-visible:ring-2 focus-visible:ring-red-500
                         transition-colors"
            >
              ×
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onChoose("core1")}
              className="flex-1 min-w-[120px] h-12 rounded-xl bg-white/10 text-white text-base
                         hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2
                         focus-visible:ring-orange-500 transition-colors"
            >
              Core&nbsp;1
            </button>
            <button
              type="button"
              onClick={() => onChoose("core2")}
              className="flex-1 min-w-[120px] h-12 rounded-xl bg-white/10 text-white text-base
                         hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2
                         focus-visible:ring-orange-500 transition-colors"
            >
              Core&nbsp;2
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

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

  // Core state
  const [selectedCore, setSelectedCore] = React.useState<CoreType | null>(null);
  const [isCoreDialogOpen, setIsCoreDialogOpen] = React.useState(false);
  const [isInitialCoreOpen, setIsInitialCoreOpen] = React.useState(true); // first time flag

  const isMobile = useIsMobile();
  const [showBackToTop, setShowBackToTop] = React.useState(false);
  const pageRef = React.useRef<HTMLDivElement>(null);
  const [savedQuestionIds, setSavedQuestionIds] = React.useState<string[]>([]);

  // First visit: open core picker (no X)
  React.useEffect(() => {
    setIsCoreDialogOpen(true);
    setIsInitialCoreOpen(true);
  }, []);

  const chooseCore = (core: CoreType) => {
    setSelectedCore(core);
    setIsCoreDialogOpen(false);
    setIsInitialCoreOpen(false); // after first choice, later opens will show X
    // reset filters/sort when core changes
    setFilters({ ...initialFilters });
    setSort("chapter_asc");
    setShowAllAnswers(false);
  };

  // Fetch questions
  const fetchQuestions = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const questionsCollection = collection(db, "questions");
      const q = query(questionsCollection, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const questionsData = querySnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Question)
      );
      const normalized = questionsData.map((qq) => ({
        ...qq,
        // default core if missing (UI-side only)
        core: (qq as any).core ?? "core1",
      }));
      setQuestions(normalized);
    } catch (error) {
      console.error("Error fetching questions: ", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // Filter questions by selected core once (source for chapters/list)
  const coreFiltered = React.useMemo(() => {
    const core = selectedCore ?? "core1";
    return questions.filter((q) => ((q as any).core ?? "core1") === core);
  }, [questions, selectedCore]);

  // Chapters based on current core only
  const chaptersForCore = React.useMemo(() => {
    const chapters = new Set<string>();
    coreFiltered.forEach((q) => q.chapter && chapters.add(q.chapter));
    const num = (s: string) => {
      const m = s?.match?.(/Chapter (\d+)/);
      return m ? parseInt(m[1], 10) : Infinity;
    };
    return Array.from(chapters).sort((a, b) => num(a) - num(b));
  }, [coreFiltered]);

  // Apply filters/sort on the coreFiltered list
  React.useEffect(() => {
    if (isExamMode) return;
    if (!selectedCore) {
      setFilteredQuestions([]);
      return;
    }

    let temp = [...coreFiltered];

    const num = (s: string) => {
      const m = s?.match?.(/Chapter (\d+)/);
      return m ? parseInt(m[1], 10) : Infinity;
    };

    const chapterSorted = [...temp].sort((a, b) => num(a.chapter) - num(b.chapter));

    // quiz slicing (45 per quiz)
    if (filters.quiz !== "all") {
      const quizNumber = parseInt(filters.quiz.replace("quiz", ""), 10);
      if (quizNumber >= 1 && quizNumber <= 6) {
        const SIZE = 45;
        let start = 0;
        let end = chapterSorted.length;
        if (quizNumber >= 1 && quizNumber <= 5) {
          start = (quizNumber - 1) * SIZE;
          end = Math.min(start + SIZE, chapterSorted.length);
        } else if (quizNumber === 6) {
          start = 5 * SIZE;
          end = chapterSorted.length;
        }
        start = Math.max(0, Math.min(start, chapterSorted.length));
        end = Math.max(start, Math.min(end, chapterSorted.length));
        temp = chapterSorted.slice(start, end);
      } else {
        temp = chapterSorted;
      }
    } else {
      temp = chapterSorted;
    }

    if (filters.recentOnly) {
      const cutoff = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);
      temp = temp.filter((q) => {
        const d = getCreatedAtDate((q as any).createdAt);
        return d ? d >= cutoff : false;
      });
    }

    if (searchQuery) {
      const sq = searchQuery.toLowerCase();
      temp = temp.filter((q) => q.questionText?.toLowerCase().includes(sq));
    }

    if (filters.showSavedOnly) {
      temp = temp.filter((q) => savedQuestionIds.includes(q.id));
    }

    if (filters.chapter.length > 0) {
      temp = temp.filter((q) => filters.chapter.includes(q.chapter));
    }
    if (filters.questionType.length > 0) {
      temp = temp.filter((q) => filters.questionType.includes(q.questionType));
    }

    // final sort
    const sorted = [...temp].sort((a, b) => {
      switch (sort) {
        case "chapter_desc": {
          return num(b.chapter) - num(a.chapter);
        }
        case "random":
          return Math.random() - 0.5;
        case "chapter_asc":
        default:
          return 0;
      }
    });

    setFilteredQuestions(sorted);
    setUserAnswers({});
  }, [coreFiltered, searchQuery, filters, sort, isExamMode, savedQuestionIds, selectedCore]);

  // Back to top button visibility
  React.useEffect(() => {
    const onWinScroll = () => setShowBackToTop(window.scrollY > 200);
    window.addEventListener("scroll", onWinScroll, { passive: true });
    return () => window.removeEventListener("scroll", onWinScroll);
  }, []);

  const handleExplainClick = (question: Question) => {
    setSelectedQuestionForExplanation(question);
    setIsExplanationPanelOpen(true);
  };

  // Exam
  const startExam = (mode: ExamMode) => {
    const pool = coreFiltered;
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
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
          const sU = [...userAnswer].sort();
          const sC = [...q.correctAnswer].sort();
          if (sU.every((v, i) => v === sC[i])) score++;
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
    const combined = [...questions];
    newQuestions.forEach((nq) => {
      const idx = combined.findIndex((q) => q.id === nq.id);
      const withCore = { ...(nq as any), core: (nq as any).core ?? "core1" };
      if (idx !== -1) combined[idx] = withCore as any;
      else combined.push(withCore as any);
    });
    combined.sort(
      (a: any, b: any) =>
        (getCreatedAtDate(b?.createdAt)?.getTime() ?? 0) -
        (getCreatedAtDate(a?.createdAt)?.getTime() ?? 0)
    );
    setQuestions(combined);
  };

  const handleQuestionDeleted = (questionId: string) => {
    setQuestions(questions.filter((q) => q.id !== questionId));
  };

  const handleQuestionUpdated = (updatedQuestion: Question) => {
    setQuestions(
      questions.map((q) =>
        q.id === updatedQuestion.id
          ? ({ ...(updatedQuestion as any), core: (updatedQuestion as any).core ?? "core1" } as any)
          : q
      )
    );
  };

  const toggleSaveQuestion = (questionId: string) => {
    setSavedQuestionIds((prev) =>
      prev.includes(questionId) ? prev.filter((id) => id !== questionId) : [...prev, questionId]
    );
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
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
          chapters={chaptersForCore}
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
              {/* quick core switch (later open -> showClose=true) */}
              <div className="absolute left-4 -bottom-4 z-20">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsInitialCoreOpen(false);
                    setIsCoreDialogOpen(true);
                  }}
                >
                  {selectedCore ? (selectedCore === "core1" ? "Core 1" : "Core 2") : "Select Core"}
                </Button>
              </div>

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

          {/* Main */}
          <main className="flex-1">
            {isLoading || !selectedCore ? (
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

        {/* Exam results */}
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

        {/* Core select (showClose depends on first/late open) */}
        <CoreSelectDialog
          isOpen={isCoreDialogOpen}
          onChoose={chooseCore}
          onClose={() => setIsCoreDialogOpen(false)}
          showClose={!isInitialCoreOpen}
        />
      </div>
    </LockProvider>
  );
}
