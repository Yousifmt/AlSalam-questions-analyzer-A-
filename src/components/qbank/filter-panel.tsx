
"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

const questionTypes = [
    { id: 'mcq', label: 'Multiple Choice' },
    { id: 'checkbox', label: 'Checkboxes' },
];

const quizzes = [
    { id: 'all', label: 'All Questions' },
    { id: 'quiz1', label: 'Quiz 1 (1-100)' },
    { id: 'quiz2', label: 'Quiz 2 (101-200)' },
    { id: 'quiz3', label: 'Quiz 3 (201-300)' },
    { id: 'quiz4', label: 'Quiz 4 (301-400)' },
    { id: 'quiz5', label: 'Quiz 5 (401-500)' },
    { id: 'quiz6', label: 'Quiz 6 (501+)' },
];

type FilterPanelProps = {
    filters: any;
    setFilters: (filters: any) => void;
    chapters: string[];
    sort: string;
    setSort: (sort: string) => void;
};

export default function FilterPanel({ filters, setFilters, chapters, sort, setSort }: FilterPanelProps) {
    const handleMultiSelectChange = (filterName: string, value: string) => {
        const currentValues = filters[filterName] as string[];
        const newValues = currentValues.includes(value)
            ? currentValues.filter((v) => v !== value)
            : [...currentValues, value];
        setFilters({ ...filters, [filterName]: newValues });
    };

    const handleSwitchChange = (filterName: string, checked: boolean) => {
        setFilters({ ...filters, [filterName]: checked });
    };
    
    const handleSelectChange = (filterName: string, value: string) => {
        setFilters({ ...filters, [filterName]: value });
    };

    return (
        <div className="space-y-4 p-4">
            <div className="space-y-2">
                <h3 className="font-headline text-lg font-semibold tracking-tight">Sort By</h3>
                 <Select value={sort} onValueChange={setSort}>
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
            <h3 className="font-headline text-lg font-semibold tracking-tight">Filters</h3>
            <Accordion type="multiple" defaultValue={['quiz', 'status', 'type']} className="w-full">
                <AccordionItem value="quiz">
                    <AccordionTrigger className="font-semibold">Quiz</AccordionTrigger>
                    <AccordionContent className="space-y-2">
                        <Select value={filters.quiz} onValueChange={(value) => handleSelectChange('quiz', value)}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a quiz" />
                            </SelectTrigger>
                            <SelectContent>
                                {quizzes.map((quiz) => (
                                    <SelectItem key={quiz.id} value={quiz.id}>{quiz.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="status">
                    <AccordionTrigger className="font-semibold">Status</AccordionTrigger>
                    <AccordionContent className="space-y-2">
                         <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                            <Label htmlFor="saved-only">Show Saved Only</Label>
                            <Switch 
                                id="saved-only"
                                checked={filters.showSavedOnly}
                                onCheckedChange={(checked) => handleSwitchChange('showSavedOnly', checked)}
                            />
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="chapter">
                    <AccordionTrigger className="font-semibold">Chapter</AccordionTrigger>
                    <AccordionContent className="space-y-2 max-h-60 overflow-y-auto">
                        {chapters.map((chapter) => (
                            <div key={chapter} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`chapter-${chapter}`}
                                    checked={filters.chapter.includes(chapter)}
                                    onCheckedChange={() => handleMultiSelectChange('chapter', chapter)}
                                />
                                <Label htmlFor={`chapter-${chapter}`}>{chapter}</Label>
                            </div>
                        ))}
                         {chapters.length === 0 && <p className="text-xs text-muted-foreground">No chapters found.</p>}
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="type">
                    <AccordionTrigger className="font-semibold">Question Type</AccordionTrigger>
                    <AccordionContent className="space-y-2">
                        {questionTypes.map((type) => (
                            <div key={type.id} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`type-${type.id}`}
                                    checked={filters.questionType.includes(type.id)}
                                    onCheckedChange={() => handleMultiSelectChange('questionType', type.id)}
                                />
                                <Label htmlFor={`type-${type.id}`}>{type.label}</Label>
                            </div>
                        ))}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}

    