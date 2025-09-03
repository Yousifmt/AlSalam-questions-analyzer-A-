'use server';

/**
 * @fileOverview An AI agent that explains exam questions.
 *
 * - explainQuestion - A function that handles the question explanation process.
 * - ExplainQuestionInput - The input type for the explainQuestion function.
 * - ExplainQuestionOutput - The return type for the explainQuestion function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExplainQuestionInputSchema = z.object({
  questionText: z.string().describe('The text of the question.'),
  options: z.array(z.string()).optional().describe('The options for the question, if it is a multiple choice question.'),
  correctAnswer: z.union([z.string(), z.array(z.string())]).optional().describe('The correct answer(s) to the question.'),
  explanation: z.string().optional().describe('An existing explanation for the question.'),
  level: z.enum(['short', 'full']).describe('The level of detail for the explanation.'),
  language: z.enum(['ar', 'en']).describe('The language for the explanation.'),
});
export type ExplainQuestionInput = z.infer<typeof ExplainQuestionInputSchema>;

const ExplainQuestionOutputSchema = z.object({
    language: z.enum(['ar', 'en']).describe('The language of the explanation.'),
    generalExplanation: z.string().describe('A general explanation of the question and its context.'),
    correctAnswerExplanation: z.string().describe('A specific explanation of why the correct answer is right.'),
    whyOthersWrong: z
      .array(
        z.object({
          option: z.string().describe('The incorrect option.'),
          reason: z.string().describe('The reason why this option is incorrect.'),
        })
      )
      .optional()
      .describe('Reasons why other options are wrong, if the question is multiple choice.'),
  });
export type ExplainQuestionOutput = z.infer<typeof ExplainQuestionOutputSchema>;

export async function explainQuestion(input: ExplainQuestionInput): Promise<ExplainQuestionOutput> {
  return explainQuestionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'explainQuestionPrompt',
  input: {schema: ExplainQuestionInputSchema},
  output: {schema: ExplainQuestionOutputSchema},
  prompt: `You explain exam questions for students.
Output only the requested JSON schema.
Be concise, accurate, and didactic.
Do not reveal internal reasoning or chain-of-thought.
If the question is MCQ, include "whyOthersWrong".
Respect the target language ("ar" or "en") and use simple, professional style.

Explain the following question at LEVEL={{{level}}} in LANGUAGE={{{language}}}.
The explanation should have three parts:
1.  generalExplanation: A general explanation of the core concepts.
2.  correctAnswerExplanation: A specific explanation of why the correct answer is correct.
3.  whyOthersWrong: For MCQs, an analysis of each incorrect option.

Question: {{{questionText}}}
Options: {{#if options}}{{{options}}}{{else}}N/A{{/if}}
Correct Answer: {{#if correctAnswer}}{{{correctAnswer}}}{{else}}N/A{{/if}}
Existing Explanation (if any): {{#if explanation}}{{{explanation}}}{{else}}N/A{{/if}}`,
});

const explainQuestionFlow = ai.defineFlow(
  {
    name: 'explainQuestionFlow',
    inputSchema: ExplainQuestionInputSchema,
    outputSchema: ExplainQuestionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
