'use server';

/**
 * @fileOverview Flow to find similar questions semantically based on a given question and a list of existing questions.
 *
 * - findSimilarQuestions - A function that handles the process of finding similar questions.
 * - FindSimilarQuestionsInput - The input type for the findSimilarQuestions function.
 * - FindSimilarQuestionsOutput - The return type for the findSimilarQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const QuestionSchema = z.object({
  id: z.string(),
  questionText: z.string(),
});

const FindSimilarQuestionsInputSchema = z.object({
  question: QuestionSchema.describe('The question to find similarities for.'),
  questionBank: z.array(QuestionSchema).describe('The list of all questions to search within.'),
});
export type FindSimilarQuestionsInput = z.infer<typeof FindSimilarQuestionsInputSchema>;

const FindSimilarQuestionsOutputSchema = z.array(z.object({
  id: z.string().describe('The ID of the similar question.'),
  questionText: z.string().describe('The text of the similar question.'),
  similarityScore: z.number().describe('The cosine similarity score between the input question and the similar question.'),
}));
export type FindSimilarQuestionsOutput = z.infer<typeof FindSimilarQuestionsOutputSchema>;

export async function findSimilarQuestions(input: FindSimilarQuestionsInput): Promise<FindSimilarQuestionsOutput> {
  return findSimilarQuestionsFlow(input);
}

const findSimilarQuestionsPrompt = ai.definePrompt({
  name: 'findSimilarQuestionsPrompt',
  input: {schema: FindSimilarQuestionsInputSchema},
  output: {schema: FindSimilarQuestionsOutputSchema},
  prompt: `You are an expert at identifying similar questions. Given the following question, find the top 3 most similar questions from the provided question bank. Do not include the original question in the results.

Question to match:
- ID: {{{question.id}}}
- Text: {{{question.questionText}}}

Question Bank:
{{#each questionBank}}
- ID: {{{this.id}}}
- Text: {{{this.questionText}}}
{{/each}}

Return a JSON array of up to 3 similar questions, including their original ID, question text, and a similarity score between 0 and 1.`,
});

const findSimilarQuestionsFlow = ai.defineFlow(
  {
    name: 'findSimilarQuestionsFlow',
    inputSchema: FindSimilarQuestionsInputSchema,
    outputSchema: FindSimilarQuestionsOutputSchema,
  },
  async input => {
    // Filter out the source question from the bank to avoid matching it with itself
    const filteredBank = input.questionBank.filter(q => q.id !== input.question.id);
    const {output} = await findSimilarQuestionsPrompt({
        ...input,
        questionBank: filteredBank
    });
    return output!;
  }
);
