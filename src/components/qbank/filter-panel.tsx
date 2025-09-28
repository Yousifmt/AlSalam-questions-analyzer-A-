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

// Updated labels for 45-per-quiz scheme
const quizzes = [
  { id: "all", label: "All Questions" },
  { id: "quiz1", label: "Quiz 1 (1–45)" },
  { id: "quiz2", label: "Quiz 2 (46–90)" },
  { id: "quiz3", label: "Quiz 3 (91–135)" },
  { id: "quiz4", label: "Quiz 4 (136–180)" },
  { id: "quiz5", label: "Quiz 5 (181–225)" },
  { id: "quiz6", label: "Quiz 6 (226+ / remaining)" },
];

type FilterPanelProps = {
  filters: any;
  setFilters: (filters: any) => void;
  chapters: string[];
  sort: SortType;
  setSort: React.Dispatch<React.SetStateAction<SortType>>;
  onCloseSheet: () => void;
};

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
            {quizzes.map((quiz) => (
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
            {chapters.map((chapter) => (
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
            {chapters.length === 0 && (
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
