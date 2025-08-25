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

  CRITICAL: You must choose only ONE chapter from this list, and the 'chapter' field in your output JSON must be an EXACT string match to one of the options provided. Do not abbreviate or use only numbers. The subject is always "Cyber Security".

  Available Chapters:
  - Chapter 1: Summarizing Fundamental Security Concepts
  - Chapter 2: Comparing Threat Types
  - Chapter 3: Explaining Appropriate Cryptographic Solutions
  - Chapter 4: Implement Identity and Access Management
  - Chapter 5: Maintain Enterprise Campus Network Architecture
  - Chapter 6: Secure Cloud Network Architecture
  - Chapter 7: Explain Resiliency and Site Security Concepts
  - Chapter 8: Evaluate Network Security Capabilities
  - Chapter 9: Explain Vulnerability Management
  - Chapter 10: Assess Endpoint Security Capabilities
  - Chapter 11: Enhance Application Security Capabilities
  - Chapter 12: Explain Alerting and Monitoring Concepts
  - Chapter 13: Analyze Indicators of Malicious Activity
  - Chapter 14: Summarize Security Governance Concepts
  - Chapter 15: Explain Risk Management Processes
  - Chapter 16: Summarize Data Protection and Compliance Concepts

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
