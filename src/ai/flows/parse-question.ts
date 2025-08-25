
// src/ai/flows/parse-question.ts
'use server';

/**
 * @fileOverview Parses a block of mixed-format exam questions (English/Arabic) into structured records.
 *
 * @function parseQuestionsFromText - Parses questions from text using an LLM.
 * @interface ParseQuestionsInput - Input type for the parseQuestionsFromText function.
 * @interface ParseQuestionsOutput - Output type for the parseQuestionsFromText function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ParseQuestionsInputSchema = z.object({
  text: z
    .string()
    .describe(
      'A block of mixed-format exam questions in English and Arabic to be parsed.'
    ),
});
export type ParseQuestionsInput = z.infer<typeof ParseQuestionsInputSchema>;

const ParseQuestionsOutputSchema = z.array(z.object({
  questionText: z.string().describe('The text of the question, with any numbering or prefixes like "Question:" removed.'),
  options: z.array(z.string()).optional().describe('The possible options for a multiple-choice question.'),
  correctAnswer: z.union([z.string(), z.array(z.string())]).optional().describe('The correct answer(s) to the question.'),
  explanation: z.string().optional().describe('An explanation of the correct answer.'),
  subject: z.string().describe('The subject of the question.'),
  chapter: z.string().describe('The chapter of the question.'),
  topicTags: z.array(z.string()).optional().describe('Tags related to the topic of the question.'),
  questionType: z.enum(['mcq', 'checkbox']).describe('The type of question (mcq, checkbox).'),
  difficulty: z.string().describe('The difficulty level of the question (easy, medium, hard).'),
  language: z.string().describe('The language of the question (ar, en).'),
  source: z.string().optional().describe('The source of the question, if known.'),
  createdAt: z.string().optional().describe('The timestamp when the question was created.'),
}));
export type ParseQuestionsOutput = z.infer<typeof ParseQuestionsOutputSchema>;

export async function parseQuestionsFromText(input: ParseQuestionsInput): Promise<ParseQuestionsOutput> {
  return parseQuestionsFlow(input);
}

const parseQuestionsPrompt = ai.definePrompt({
  name: 'parseQuestionsPrompt',
  input: {schema: ParseQuestionsInputSchema},
  output: {schema: ParseQuestionsOutputSchema},
  prompt: `You are an expert at parsing exam questions from text.

  Your task is to take a block of mixed-format exam questions and parse them into a structured JSON array.
  The questions may be in English or Arabic. Each question starts with a number, a "Q", or is clearly separated by newlines.

  CRITICAL: You must process each question as a self-contained unit. For each question you identify, find its text, options, and correct answer before moving to the next question. This is crucial for accuracy when parsing multiple questions.

  CRITICAL: You must clean the question text by removing any numbering, lettering, or prefixes like "Question:", "Q1)", "1.", or junk text like "CertyIQ". For example, "Question 1: What is the capital of France?" should become "What is the capital of France?". Similarly, "Q2: ما هي عاصمة مصر؟" should become "ما هي عاصمة مصر؟". "Question: 26 CertyIQ" should be ignored or result in an empty question.

  CRITICAL: You must accurately detect the correct answer for each question. It could be prefixed with "Correct Answer:", "Answer:", "Ans:", or just be on a line by itself. The answer value should match one of the options exactly if it's an MCQ. For "A) Paris", the answer is "Paris".

  CRITICAL: If the answer is specified by letter (e.g., "Answer: A" or "Correct Answer: B, C"), you MUST map that letter back to the full text of the corresponding option. For example, if option A is "Jump server", then "Answer: A" means the correctAnswer is "Jump server". If there are multiple correct answers indicated (e.g. a list of letters or answers), the questionType MUST be set to "checkbox" and the correctAnswer field should be an array of the full option texts.

  CRITICAL: Infer the subject and chapter for each question based on its content. The subject is always "Cyber Security". The chapter must be one of the following 16 options. Choose the one that best fits the question's topic.

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

  Also infer these fields:
  - topicTags: Generate a few relevant topic tags.
  - questionType: (mcq, checkbox).
      - If options are present and there is only ONE correct answer, it's 'mcq'.
      - If options are present and there are MULTIPLE correct answers (e.g. correct answer is an array or indicated in text), it's 'checkbox'.
  - difficulty: (easy, medium, hard).
  - language: (ar, en).
  - source: (optional).

  Process the entire text block and identify all questions within it.

  Example Input Text:
  1. What is the difference between a virus and a worm?
  A) Viruses require a host file, worms do not.
  B) Worms require a host file, viruses do not.
  C) Both require a host file.
  D) Neither requires a host file.
  Correct Answer: A
  Subject: Cyber Security

  Example Output:
  [
    {
      "questionText": "What is the difference between a virus and a worm?",
      "options": ["Viruses require a host file, worms do not.", "Worms require a host file, viruses do not.", "Both require a host file.", "Neither requires a host file."],
      "correctAnswer": "Viruses require a host file, worms do not.",
      "explanation": "",
      "subject": "Cyber Security",
      "chapter": "Chapter 2: Comparing Threat Types",
      "topicTags": ["malware", "virus", "worm"],
      "questionType": "mcq",
      "difficulty": "easy",
      "language": "en",
      "source": "",
      "createdAt": ""
    }
  ]

  Input Text:
  {{{text}}}
  `,
});

const parseQuestionsFlow = ai.defineFlow(
  {
    name: 'parseQuestionsFlow',
    inputSchema: ParseQuestionsInputSchema,
    outputSchema: ParseQuestionsOutputSchema,
  },
  async input => {
    const {output} = await parseQuestionsPrompt(input);
    return output!;
  }
);
