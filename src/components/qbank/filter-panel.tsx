// src/components/qbank/filter-panel.tsx
"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "../ui/scroll-area";
import * as React from "react";
import type { SortType } from "./filter-sheet";

// keep in sync with page.tsx
const RECENT_DAYS = 10;

const questionTypes = [
  { id: "mcq", label: "Multiple Choice" },
  { id: "checkbox", label: "Checkboxes" },
];

type FilterPanelProps = {
  filters: any;
  setFilters: (filters: any) => void;
  chapters: string[];
  sort: SortType;
  setSort: React.Dispatch<React.SetStateAction<SortType>>;
  onCloseSheet: () => void;
};

// extract "12" from "Module 12: ..." or "Chapter 12: ..."
function chapterNumber(s: string): number {
  const m = s.match(/(?:module|chapter)\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
}

/** لبناء تسميات الكويز لـ Core 2: 5 كويزات فقط — أول 4 بحجم 45، الخامس للمتبقي كله */
function buildCore2Quizzes(total: number) {
  const SIZE = 45;
  const items: Array<{ id: string; label: string }> = [{ id: "all", label: "All Questions" }];

  // Quiz 1..4: ثابتة 45
  for (let i = 0; i < 4; i++) {
    const start = i * SIZE + 1;
    const end = Math.min((i + 1) * SIZE, Math.max(total, start));
    items.push({ id: `quiz${i + 1}`, label: `Quiz ${i + 1} (${start}–${end})` });
  }

  // Quiz 5: من 181 إلى total (قد يكون > 45 وهذا المطلوب)
  if (total >= 181) {
    items.push({ id: "quiz5", label: `Quiz 5 (181–${total})` });
  } else {
    // لو أقل من 181 (نادر)، أعرض تسمية عامة
    items.push({ id: "quiz5", label: `Quiz 5 (181+ / remaining)` });
  }

  return items;
}

/** تسميات Core 1 تبقى كما هي: 6 كويزات */
const CORE1_QUIZZES_STATIC = [
  { id: "all", label: "All Questions" },
  { id: "quiz1", label: "Quiz 1 (1–45)" },
  { id: "quiz2", label: "Quiz 2 (46–90)" },
  { id: "quiz3", label: "Quiz 3 (91–135)" },
  { id: "quiz4", label: "Quiz 4 (136–180)" },
  { id: "quiz5", label: "Quiz 5 (181–225)" },
  { id: "quiz6", label: "Quiz 6 (226+ / remaining)" },
];

export default function FilterPanel({
  filters,
  setFilters,
  chapters,
  sort,
  setSort,
  onCloseSheet,
}: FilterPanelProps) {
  const handleMultiSelectChange = (filterName: string, value: string) => {
    const currentValues = filters[filterName] as string[];
    const newValues = currentValues.includes(value)
      ? currentValues.filter((v: string) => v !== value)
      : [...currentValues, value];
    setFilters({ ...filters, [filterName]: newValues });
  };

  const handleSwitchChange = (filterName: string, checked: boolean) => {
    setFilters({ ...filters, [filterName]: checked });
    if (filterName === "showSavedOnly" || filterName === "recentOnly") {
      onCloseSheet();
    }
  };

  const handleSelectChange = (filterName: string, value: string) => {
    setFilters({ ...filters, [filterName]: value });
    if (filterName === "quiz") onCloseSheet();
  };

  // ✅ sort chapters numerically
  const chaptersSorted = React.useMemo(() => {
    return [...chapters].sort((a, b) => {
      const na = chapterNumber(a);
      const nb = chapterNumber(b);
      if (na === nb) return a.localeCompare(b);
      return na - nb;
    });
  }, [chapters]);

  // معلومات الكور والعدد تُمرّر من الصفحة عبر filters
  const activeCore: "core1" | "core2" = (filters?._activeCore as any) ?? "core1";
  const coreTotalCount: number = Number(filters?._coreCount ?? 0);

  // خيارات الكويز ديناميكية: Core 1 ثابتة، Core 2 = 5 كويزات فقط
  const quizOptions = React.useMemo(() => {
    return activeCore === "core2" ? buildCore2Quizzes(coreTotalCount || 230) : CORE1_QUIZZES_STATIC;
  }, [activeCore, coreTotalCount]);

  return (
    <div className="space-y-6 p-4">
      <div className="space-y-2">
        <Label className="font-semibold text-foreground">Sort By</Label>
        <Select value={sort} onValueChange={(val) => setSort(val as SortType)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="chapter_asc">Chapter (Ascending)</SelectItem>
            <SelectItem value="chapter_desc">Chapter (Descending)</SelectItem>
            <SelectItem value="random">Random</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label className="font-semibold text-foreground">Quiz</Label>
        <Select value={filters.quiz} onValueChange={(value) => handleSelectChange("quiz", value)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a quiz" />
          </SelectTrigger>
          <SelectContent>
            {quizOptions.map((quiz) => (
              <SelectItem key={quiz.id} value={quiz.id}>
                {quiz.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label className="font-semibold text-foreground">Chapter</Label>
        <ScrollArea className="h-60 w-full rounded-md border p-2">
          <div className="space-y-2">
            {chaptersSorted.map((chapter) => (
              <div key={chapter} className="flex items-center space-x-2">
                <Checkbox
                  id={`chapter-${chapter}`}
                  checked={filters.chapter.includes(chapter)}
                  onCheckedChange={() => handleMultiSelectChange("chapter", chapter)}
                />
                <Label htmlFor={`chapter-${chapter}`} className="font-normal">
                  {chapter}
                </Label>
              </div>
            ))}
            {chaptersSorted.length === 0 && (
              <p className="text-xs text-gray-400">No chapters found.</p>
            )}
          </div>
        </ScrollArea>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label className="font-semibold text-foreground">Status & Type</Label>

        {/* Saved Questions */}
        <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
          <Label htmlFor="saved-only" className="flex flex-col space-y-1">
            <span>Saved Questions</span>
            <span className="font-normal leading-snug text-gray-400">
              Only show questions you have bookmarked.
            </span>
          </Label>
          <Switch
            id="saved-only"
            checked={filters.showSavedOnly}
            onCheckedChange={(checked) => handleSwitchChange("showSavedOnly", checked)}
          />
        </div>

        {/* Latest Added (Last {RECENT_DAYS} Days) */}
        <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
          <Label htmlFor="recent-only" className="flex flex-col space-y-1">
            <span>Latest Added (Last {RECENT_DAYS} Days)</span>
            <span className="font-normal leading-snug text-gray-400">
              Show only questions added within the last {RECENT_DAYS} days.
            </span>
          </Label>
          <Switch
            id="recent-only"
            checked={!!filters.recentOnly}
            onCheckedChange={(checked) => handleSwitchChange("recentOnly", checked)}
          />
        </div>

        {/* Types */}
        <div className="space-y-2 pt-2">
          {questionTypes.map((type) => (
            <div key={type.id} className="flex items-center space-x-2">
              <Checkbox
                id={`type-${type.id}`}
                checked={filters.questionType.includes(type.id)}
                onCheckedChange={() => handleMultiSelectChange("questionType", type.id)}
              />
              <Label htmlFor={`type-${type.id}`} className="font-normal">
                {type.label}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
