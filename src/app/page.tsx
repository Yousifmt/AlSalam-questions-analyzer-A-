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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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

// -------- Core Select Dialog (centered using Dialog) ----------
// مودال يدوي: Overlay + صندوق متمركز بالقوة
// مودال يدوي مهيّأ للجوال: Overlay + صندوق متمركز ومرن
function CoreSelectDialog({
  isOpen,
  onChoose,
  onClose,
}: {
  isOpen: boolean;
  onChoose: (core: CoreType) => void;
  onClose: () => void;
}) {
  React.useEffect(() => {
    if (!isOpen) return;
    // إغلاق بـ ESC ومنع سكرول الخلفية
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[999] bg-black/60"
        onClick={onClose}
      />

      {/* محتوى متمركز – يناسب الموبايل */}
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
          <h2 id="core-dialog-title" className="text-lg font-semibold">Select Core</h2>
          <p id="core-dialog-desc" className="mt-1 text-sm text-white/70">
            Choose which question set you want to view.
          </p>

          {/* زر إغلاق (Hover أحمر) */}
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
        </div>

        {/* لف داخلي إذا طال المحتوى */}
        <div className="mt-4 overflow-auto">
          {/* الأزرار: جنب بعض وتلتف على الشاشات الضيقة */}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="flex-1 min-w-[120px] h-12 rounded-xl bg-white/10 text-white text-base
                         hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2
                         focus-visible:ring-orange-500 transition-colors"
              onClick={() => onChoose("core1")}
            >
              Core&nbsp;1
            </button>
            <button
              type="button"
              className="flex-1 min-w-[120px] h-12 rounded-xl bg-white/10 text-white text-base
                         hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2
                         focus-visible:ring-orange-500 transition-colors"
              onClick={() => onChoose("core2")}
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

  // Core
  const [selectedCore, setSelectedCore] = React.useState<CoreType | null>(null);
  const [isCoreDialogOpen, setIsCoreDialogOpen] = React.useState(false);

  const isMobile = useIsMobile();
  const [showBackToTop, setShowBackToTop] = React.useState(false);
  const pageRef = React.useRef<HTMLDivElement>(null);

  const [savedQuestionIds, setSavedQuestionIds] = React.useState<string[]>([]);

  // Always open core dialog on first mount (ask every visit)
  React.useEffect(() => {
    setIsCoreDialogOpen(true);
  }, []);

  const chooseCore = (core: CoreType) => {
    setSelectedCore(core);
    setIsCoreDialogOpen(false);
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

      // Default core = core1 if missing (UI only)
      const normalized = questionsData.map((qq) => ({
        ...qq,
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

  // Chapters
  const allChapters = React.useMemo(() => {
    const chapters = new Set<string>();
    questions.forEach((q) => q.chapter && chapters.add(q.chapter));
    const getChapterNumber = (chapterString: string) => {
      const match = chapterString?.match?.(/Chapter (\d+)/);
      return match ? parseInt(match[1], 10) : Infinity;
    };
    return Array.from(chapters).sort((a, b) => getChapterNumber(a) - getChapterNumber(b));
  }, [questions]);

  // Filters + sort
  React.useEffect(() => {
    if (isExamMode) return;
    if (!selectedCore) {
      setFilteredQuestions([]);
      return;
    }

    let tempQuestions = questions.filter((q) => ((q as any).core ?? "core1") === selectedCore);

    const getChapterNumber = (chapterString: string) => {
      const match = chapterString?.match?.(/Chapter (\d+)/);
      return match ? parseInt(match[1], 10) : Infinity;
    };

    const chapterSorted = [...tempQuestions].sort(
      (a, b) => getChapterNumber(a.chapter) - getChapterNumber(b.chapter)
    );

    if (filters.quiz !== "all") {
      const quizNumber = parseInt(filters.quiz.replace("quiz", ""), 10);
      if (quizNumber >= 1 && quizNumber <= 6) {
        const QUIZ_SIZE = 45;
        let startIndex = 0;
        let endIndex = chapterSorted.length;
        if (quizNumber >= 1 && quizNumber <= 5) {
          startIndex = (quizNumber - 1) * QUIZ_SIZE;
          endIndex = Math.min(startIndex + QUIZ_SIZE, chapterSorted.length);
        } else if (quizNumber === 6) {
          startIndex = 5 * QUIZ_SIZE;
          endIndex = chapterSorted.length;
        }
        startIndex = Math.max(0, Math.min(startIndex, chapterSorted.length));
        endIndex = Math.max(startIndex, Math.min(endIndex, chapterSorted.length));
        tempQuestions = chapterSorted.slice(startIndex, endIndex);
      } else {
        tempQuestions = chapterSorted;
      }
    } else {
      tempQuestions = chapterSorted;
    }

    if (filters.recentOnly) {
      const cutoff = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);
      tempQuestions = tempQuestions.filter((q) => {
        const d = getCreatedAtDate((q as any).createdAt);
        return d ? d >= cutoff : false;
      });
    }

    if (searchQuery) {
      const sq = searchQuery.toLowerCase();
      tempQuestions = tempQuestions.filter((q) => q.questionText?.toLowerCase().includes(sq));
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

    const sortedQuestions = [...tempQuestions].sort((a, b) => {
      const n = (s: string) => {
        const m = s?.match?.(/Chapter (\d+)/);
        return m ? parseInt(m[1], 10) : Infinity;
      };
      switch (sort) {
        case "chapter_desc":
          return n(b.chapter) - n(a.chapter);
        case "random":
          return Math.random() - 0.5;
        case "chapter_asc":
        default:
          return 0;
      }
    });

    setFilteredQuestions(sortedQuestions);
    setUserAnswers({});
  }, [searchQuery, filters, questions, sort, isExamMode, savedQuestionIds, selectedCore]);

  // Back-to-top
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
    const pool = questions.filter((q) => ((q as any).core ?? "core1") === (selectedCore ?? "core1"));
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
    const combinedQuestions = [...questions];
    newQuestions.forEach((newQ) => {
      const index = combinedQuestions.findIndex((q) => q.id === newQ.id);
      const withCore = { ...(newQ as any), core: (newQ as any).core ?? "core1" };
      if (index !== -1) {
        combinedQuestions[index] = withCore as any;
      } else {
        combinedQuestions.push(withCore as any);
      }
    });
    combinedQuestions.sort(
      (a: any, b: any) =>
        (getCreatedAtDate(a?.createdAt)?.getTime() ?? 0) -
        (getCreatedAtDate(b?.createdAt)?.getTime() ?? 0)
    );
    setQuestions(combinedQuestions);
  };

  const handleQuestionDeleted = (questionId: string) => {
    setQuestions(questions.filter((q) => q.id !== questionId));
  };

  const handleQuestionUpdated = (updatedQuestion: Question) => {
    setQuestions(
      questions.map((q) =>
        q.id === updatedQuestion.id ? ({ ...(updatedQuestion as any), core: (updatedQuestion as any).core ?? "core1" } as any) : q
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
              {/* quick core switch */}
              <div className="absolute left-4 -bottom-4 z-20">
                <Button variant="outline" size="sm" onClick={() => setIsCoreDialogOpen(true)}>
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

        {/* Core select dialog (centered) */}
        <CoreSelectDialog
          isOpen={isCoreDialogOpen}
          onChoose={chooseCore}
          onClose={() => setIsCoreDialogOpen(false)}
        />
      </div>
    </LockProvider>
  );
}
