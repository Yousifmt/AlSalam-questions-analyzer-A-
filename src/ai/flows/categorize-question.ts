'use server';

/**
 * @fileOverview An AI agent that categorizes a single exam question into a specific chapter.
 *
 * - categorizeQuestion - A function that handles the question categorization process.
 * - CategorizeQuestionInput - The input type for the categorizeQuestion function.
 * - CategorizeQuestionOutput - The return type for the categorizeQuestion function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CategorizeQuestionInputSchema = z.object({
  questionText: z.string().describe('The text of the question.'),
  options: z.array(z.string()).optional().describe('The options for the question, if it is a multiple choice question.'),
  correctAnswer: z.union([z.string(), z.array(z.string())]).optional().describe('The correct answer(s) to the question.'),
});
export type CategorizeQuestionInput = z.infer<typeof CategorizeQuestionInputSchema>;

const CategorizeQuestionOutputSchema = z.object({
  chapter: z.string().describe('The chapter the question belongs to.'),
});
export type CategorizeQuestionOutput = z.infer<typeof CategorizeQuestionOutputSchema>;

export async function categorizeQuestion(input: CategorizeQuestionInput): Promise<CategorizeQuestionOutput> {
  return categorizeQuestionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'categorizeQuestionPrompt',
  input: {schema: CategorizeQuestionInputSchema},
  output: {schema: CategorizeQuestionOutputSchema},
  prompt: `You are an expert at categorizing exam questions. Your task is to assign the given question to the most appropriate chapter from the list below.

  CRITICAL: You must choose only ONE chapter from this list, and the 'chapter' field in your output JSON must be an EXACT string match to one of the options provided. Do not abbreviate or use only numbers. The subject is always "IT Support".

  Available Chapters:
  - Chapter 1: What Does an IT Specialist Do?
  - Chapter 2: Installing Motherboards and Connectors
  - Chapter 3: Installing System Devices
  - Chapter 4: Troubleshooting PC Hardware
  - Chapter 5: Comparing Local Networking Hardware
  - Chapter 6: Configuring Network Addressing and Internet Connections
  - Chapter 7: Supporting Network Services
  - Chapter 8: Summarizing Virtualization and Cloud Concepts
  - Chapter 9: Supporting Mobile Devices
  - Chapter 10: Supporting Print Devices

  Analyze the following question and determine its chapter.

  Question: {{{questionText}}}
  {{#if options}}Options: {{{options}}}{{/if}}
  {{#if correctAnswer}}Correct Answer: {{{correctAnswer}}}{{/if}}
  `,
});

const categorizeQuestionFlow = ai.defineFlow(
  {
    name: 'categorizeQuestionFlow',
    inputSchema: CategorizeQuestionInputSchema,
    outputSchema: CategorizeQuestionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
