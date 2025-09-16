
'use server';

/**
 * @fileOverview Flow to find duplicate questions from a list of existing questions.
 *
 * - findDuplicateQuestions - A function that handles the process of finding duplicate questions.
 * - FindDuplicateQuestionsInput - The input type for the findDuplicateQuestions function.
 * - FindDuplicateQuestionsOutput - The return type for the findDuplicateQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const QuestionSchema = z.object({
  id: z.string(),
  questionText: z.string(),
  options: z.array(z.string()).optional(),
  correctAnswer: z.union([z.string(), z.array(z.string())]).optional(),
  chapter: z.string().optional(),
});
export type QuestionForDeduplication = z.infer<typeof QuestionSchema>;

const FindDuplicateQuestionsInputSchema = z.object({
  questionBank: z.array(QuestionSchema).describe('The list of all questions to search within for duplicates.'),
});
export type FindDuplicateQuestionsInput = z.infer<typeof FindDuplicateQuestionsInputSchema>;

// The output is an array of groups, where each group is an array of questions that are duplicates of each other.
const FindDuplicateQuestionsOutputSchema = z.array(z.array(QuestionSchema));
export type FindDuplicateQuestionsOutput = z.infer<typeof FindDuplicateQuestionsOutputSchema>;


export async function findDuplicateQuestions(input: FindDuplicateQuestionsInput): Promise<FindDuplicateQuestionsOutput> {
  return findDuplicateQuestionsFlow(input);
}

const findDuplicateQuestionsPrompt = ai.definePrompt({
  name: 'findDuplicateQuestionsPrompt',
  input: {schema: FindDuplicateQuestionsInputSchema},
  output: {schema: FindDuplicateQuestionsOutputSchema},
  prompt: `You are an expert at identifying duplicate exam questions.
Your task is to analyze the provided question bank and group together any questions that are duplicates.

CRITICAL: A question is considered a duplicate ONLY if it meets two conditions simultaneously:
1. The 'questionText' must be an EXACT, case-sensitive match.
2. The 'correctAnswer' must be an EXACT, case-sensitive match. If it is an array, the contents must be identical.

Any variation in wording, spacing, or punctuation means it is NOT a duplicate.

CRITICAL: Each question object you include in an output group must be the FULL original object from the input, including all its fields (id, questionText, options, etc.).

Iterate through the entire question bank and identify all such groups of duplicates.
Return a JSON array, where each item in the array is another array representing a group of duplicate questions.

Example: If questions with ID "1a", "1b", and "1c" are duplicates, and "2x" and "2y" are duplicates, the output should be: [[{id: "1a", ...}, {id: "1b", ...}, {id: "1c", ...}], [{id: "2x", ...}, {id: "2y", ...}]]

If no duplicates are found, return an empty array.

Question Bank:
{{#each questionBank}}
- ID: {{{this.id}}}
- Text: {{{this.questionText}}}
- Options: {{#if this.options}} {{{this.options}}} {{else}} N/A {{/if}}
- Answer: {{#if this.correctAnswer}} {{{this.correctAnswer}}} {{else}} N/A {{/if}}
{{/each}}
  `,
});

const findDuplicateQuestionsFlow = ai.defineFlow(
  {
    name: 'findDuplicateQuestionsFlow',
    inputSchema: FindDuplicateQuestionsInputSchema,
    outputSchema: FindDuplicateQuestionsOutputSchema,
  },
  async input => {
    const {output} = await findDuplicateQuestionsPrompt(input);
    return output!;
  }
);
