'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { CORE1_BULLETS, CORE2_BULLETS } from './core-taxonomy';

const CategorizeQuestionInputSchema = z.object({
  questionText: z.string().describe('The text of the question.'),
  options: z.array(z.string()).optional().describe('Options for MCQ (if any).'),
  correctAnswer: z.union([z.string(), z.array(z.string())]).optional().describe('Correct answer(s).'),
  core: z.enum(['core1', 'core2']).optional(),
});
export type CategorizeQuestionInput = z.infer<typeof CategorizeQuestionInputSchema>;

const CategorizeQuestionOutputSchema = z.object({
  core: z.enum(['core1', 'core2']).describe('Detected or forced core.'),
  chapter: z.string().describe('Exact chapter/module string from the chosen core list.'),
});
export type CategorizeQuestionOutput = z.infer<typeof CategorizeQuestionOutputSchema>;

export async function categorizeQuestion(input: CategorizeQuestionInput): Promise<CategorizeQuestionOutput> {
  return categorizeQuestionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'categorizeQuestionPrompt',
  input: { schema: CategorizeQuestionInputSchema },
  output: { schema: CategorizeQuestionOutputSchema },
  prompt: `
You are an expert that **first decides the core** then picks **exactly one** chapter from that core's list.

- If "core" is provided in input, you MUST use that core.
- If "core" is not provided, infer it:
  • "core1" — security/IAM/crypto/cloud/resiliency/vuln mgmt/endpoint/app/monitoring/malicious indicators/governance/risk/data protection.
  • "core2" — Windows configuration/management/support/security, OS install/other OS, SOHO security, security settings, mobile software, data security usage, operational procedures.

CRITICAL RULES:
- Return JSON with keys: "core" and "chapter".
- "chapter" MUST be an **EXACT** string from the selected core list (no abbreviations).
- Choose ONE item only.

Core 1 (use these exact strings):
${CORE1_BULLETS}

Core 2 (use these exact strings):
${CORE2_BULLETS}

Question: {{{questionText}}}
{{#if options}}Options: {{{options}}}{{/if}}
{{#if correctAnswer}}Correct Answer: {{{correctAnswer}}}{{/if}}
{{#if core}}Forced core: {{{core}}}{{/if}}
  `,
});

const categorizeQuestionFlow = ai.defineFlow(
  {
    name: 'categorizeQuestionFlow',
    inputSchema: CategorizeQuestionInputSchema,
    outputSchema: CategorizeQuestionOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
