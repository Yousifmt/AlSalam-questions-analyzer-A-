'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

/* ────────────────────────────────
   Schemas
────────────────────────────────── */
const ParseQuestionsInputSchema = z.object({
  text: z.string().describe('A block of mixed-format exam questions (EN/AR).'),
});
export type ParseQuestionsInput = z.infer<typeof ParseQuestionsInputSchema>;

/** NOTE: core & chapter are OPTIONAL here (we do NOT classify during parsing). */
const ParseItemSchema = z.object({
  questionText: z.string(),
  options: z.array(z.string()).optional(),
  correctAnswer: z.union([z.string(), z.array(z.string())]).optional(),
  explanation: z.string().optional(),
  subject: z.string().optional(),          // default to "Cyber Security"
  core: z.enum(['core1', 'core2']).optional(), // DO NOT set here; UI/batch will decide
  chapter: z.string().optional(),          // DO NOT set here
  topicTags: z.array(z.string()).optional(),
  questionType: z.enum(['mcq', 'checkbox']).optional(),
  difficulty: z.string().optional(),       // default "medium"
  language: z.string().optional(),         // detect from questionText
  source: z.string().optional(),
  createdAt: z.string().optional(),
});
const ParseQuestionsOutputSchema = z.array(ParseItemSchema);
export type ParseQuestionsOutput = z.infer<typeof ParseQuestionsOutputSchema>;

/* ────────────────────────────────
   PUBLIC API
────────────────────────────────── */
export async function parseQuestionsFromText(
  input: ParseQuestionsInput
): Promise<ParseQuestionsOutput> {
  // 0) Pre-clean junk/watermarks and normalize
  const cleaned = preClean(input.text);

  // 1) Segment into blocks (unlimited) using Answer tokens and question starts
  const blocks = segmentQuestions(cleaned);

  const out: ParseQuestionsOutput = [];

  // 2) Parse each block: Local first (best at mapping answers) → AI fallback
  for (const block of blocks) {
    // Try local robust parser
    let base = simpleExtract(block);

    // If local failed, try AI fallback (parsing only — no core/module)
    if (!base || !base.questionText || /certyiq/i.test(base.questionText)) {
      const aiItem = await parseOneWithAI(block);
      if (aiItem && aiItem.questionText && !/certyiq/i.test(aiItem.questionText)) {
        base = {
          questionText: aiItem.questionText,
          options: aiItem.options ?? [],
          correctAnswer: aiItem.correctAnswer,
          questionType: (aiItem.questionType as 'mcq' | 'checkbox') ?? 'mcq',
        };
      }
    }

    if (!base) continue;

    // Enforce/repair correctAnswer against raw block & options
    const enforced = enforceAnswerConsistency(
      {
        questionText: base.questionText,
        options: base.options,
        correctAnswer: base.correctAnswer,
        questionType: base.questionType as 'mcq' | 'checkbox',
        subject: 'Cyber Security',
        difficulty: 'medium',
        language: isArabic(base.questionText) ? 'ar' : 'en',
        createdAt: new Date().toISOString(),
      },
      block
    );

    // Ensure questionType
    if (!enforced.questionType) {
      enforced.questionType = Array.isArray(enforced.correctAnswer) ? 'checkbox' : 'mcq';
    }

    // DO NOT set core/chapter here. Let UI/batch categorizer handle it later.
    out.push(enforced);
  }

  return out;
}

/* ────────────────────────────────
   PRE-CLEAN / NORMALIZE
────────────────────────────────── */
function preClean(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/g, '')) // trim right
    .filter((line) => {
      const l = line.trim();
      // Keep blanks; drop common junk/watermarks/headers
      if (!l) return true;
      if (/^certyiq$/i.test(l)) return false;
      if (/^answer\s*key\b/i.test(l)) return false;
      if (/^page\s*\d+(?:\s*of\s*\d+)?$/i.test(l)) return false;
      // "Question: 12 CertyIQ"
      if (/^question\s*:?\s*\d+\b.*\bcertyiq\b.*$/i.test(l)) return false;
      // Standalone headers like "Question 26:"
      if (/^question\s*:?\s*\d+\s*[:.)-]?\s*$/i.test(l)) return false;
      return true;
    })
    .join('\n')
    .replace(/question\s*:?\s*\d+\s*certyiq/gi, '') // inline watermark fragment
    .replace(/\n{3,}/g, '\n\n') // collapse extra blank lines
    .trim();
}

/* ────────────────────────────────
   SEGMENTATION (UNLIMITED BLOCKS)
────────────────────────────────── */
const START_RE = /^\s*(?:question\s*\d+|q\s*\d+|\d+)\s*[:.)-]\s*/i;
const OPT_LINE_RE = /^\s*(?:([A-Ha-h])|([1-9]|10))[\)\.\:\-\u2013]?\s+(\S.*\S)\s*$/;
const ANSWER_LABEL = String.raw`(?:correct\s*(?:answer|answers?)|answers?|ans(?:wer)?|answer\s*is|correct\s*option|right\s*answer)`;
const ANSWER_TOKEN_RE = new RegExp(`\\b${ANSWER_LABEL}\\b\\s*(?:[:.\\-])?`, 'i');

function segmentQuestions(text: string): string[] {
  const lines = text.split('\n');

  const blocks: string[] = [];
  let curr: string[] = [];
  let hasOptions = false;

  const flush = () => {
    const b = curr.join('\n').trim();
    if (b) blocks.push(b);
    curr = [];
    hasOptions = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];

    // New explicit question start closes previous
    if (START_RE.test(ln) && curr.length) flush();

    curr.push(ln);

    if (OPT_LINE_RE.test(ln)) hasOptions = true;

    // Any "Answer…" occurrence closes the block
    if (ANSWER_TOKEN_RE.test(ln)) {
      flush();
      continue;
    }

    // Heuristic close: options present, blank, then another start or a new "A." start
    const next = lines[i + 1];
    const next2 = lines[i + 2];
    if (
      hasOptions &&
      typeof next === 'string' &&
      /^\s*$/.test(next) &&
      typeof next2 === 'string' &&
      (START_RE.test(next2) || /^\s*[Aa][\)\.\:\-\u2013]\s+/.test(next2))
    ) {
      flush();
      i += 1; // consume the blank
    }
  }

  if (curr.length) flush();
  return blocks;
}

/* ────────────────────────────────
   AI PARSER (SINGLE BLOCK, NO CORE/CHAPTER)
────────────────────────────────── */
const parseOnePrompt = ai.definePrompt({
  name: 'parseOneQuestionStrict',
  input: { schema: ParseQuestionsInputSchema }, // {text}
  output: { schema: ParseQuestionsOutputSchema }, // array with exactly 1 object (but core/chapter optional)
  prompt: `
You parse ONE exam question block and must RETURN AN ARRAY WITH EXACTLY ONE OBJECT.
If there is no valid question after cleaning, return [].

CLEANING
- Remove numbering like "Q1)", "1.", "Question:", and any watermark/junk such as "CertyIQ", "Answer Key", "Page x of y".
- Do not include those words in "questionText".

OPTIONS & CORRECT ANSWER (CRITICAL)
- Detect options of the form A./A)/A: … or 1./1)/1: …
- The "correctAnswer" MUST be the FULL option text mapped from:
  * letter(s): e.g., "Answer: C" → map C → the C option text,
  * number(s): e.g., "Answer: 3" → map 3 → the 3rd option text,
  * full text: if the answer is the actual option text, use that exact text.
- If multiple letters/numbers are indicated (e.g., "A and C", "B,D" or "AC"), then:
  * "questionType" = "checkbox"
  * "correctAnswer" is an array of the FULL option texts.
- If single answer: "questionType"="mcq" and "correctAnswer" is a single string.
- If you cannot find an answer, leave "correctAnswer" empty and still return the question.

SELF-CHECK (MANDATORY)
- Ensure "correctAnswer" exactly matches one of the provided "options" (or a subset if checkbox).
- If not, FIX IT by mapping letters/numbers to the actual option text.
- Do not output letter(s) alone as the answer.

DO NOT classify to "core" or "chapter". Leave them empty.

RETURN (ARRAY WITH ONE OBJECT):
{
  "questionText": string,
  "options"?: string[],
  "correctAnswer"?: string | string[],
  "questionType": "mcq" | "checkbox",
  "difficulty": "medium",
  "language": "en" | "ar",
  "subject": "Cyber Security"
}

INPUT:
{{{text}}}
  `,
});

async function parseOneWithAI(block: string) {
  try {
    const { output } = await parseOnePrompt({ text: block });
    if (!Array.isArray(output) || output.length === 0) return null;
    const item = output[0] as z.infer<typeof ParseItemSchema>;

    // Normalize a few fields if missing
    const q: z.infer<typeof ParseItemSchema> = {
      questionText: item.questionText,
      options: item.options ?? [],
      correctAnswer: item.correctAnswer,
      questionType: (item.questionType as 'mcq' | 'checkbox') ?? 'mcq',
      subject: 'Cyber Security',
      difficulty: item.difficulty ?? 'medium',
      language: item.language ?? (isArabic(item.questionText) ? 'ar' : 'en'),
      createdAt: item.createdAt ?? new Date().toISOString(),
    };
    return q;
  } catch {
    return null;
  }
}

/* ────────────────────────────────
   ENFORCER: fix/verify correctAnswer using raw block
────────────────────────────────── */
function enforceAnswerConsistency(
  item: z.infer<typeof ParseItemSchema>,
  block: string
): z.infer<typeof ParseItemSchema> {
  const options = item.options ?? [];
  if (!options.length) return item; // nothing to enforce against

  const isMember = (ans: string) =>
    options.some((o) => normalize(o) === normalize(ans));

  // If AI/local already gave a valid answer, keep it
  if (typeof item.correctAnswer === 'string') {
    if (isMember(item.correctAnswer)) return item;
  } else if (Array.isArray(item.correctAnswer) && item.correctAnswer.length) {
    const allValid = item.correctAnswer.every(isMember);
    if (allValid) return item;
  }

  // Else: re-derive from raw "Answer ..." tokens inside the block
  const derived = deriveAnswerFromBlock(block, options);

  if (derived) {
    item.correctAnswer = derived;
    item.questionType = Array.isArray(derived) ? 'checkbox' : 'mcq';
  }

  return item;
}

function deriveAnswerFromBlock(block: string, opts: string[]): string | string[] | undefined {
  const normalized = block.replace(/\r\n/g, '\n');

  // Extract the answer payload (line-start or inline)
  const ANSWER_RX_LINE = new RegExp(
    `^[^\\S\\n]*${ANSWER_LABEL}\\s*(?:[:.\\-])?\\s*([^\\n]+)\\s*$`,
    'im'
  );
  const ANSWER_RX_INLINE = new RegExp(
    `${ANSWER_LABEL}\\s*(?:[:.\\-])?\\s*([^\\n]+)`,
    'i'
  );

  let ans = '';
  const m1 = normalized.match(ANSWER_RX_LINE);
  if (m1) ans = m1[1] ?? '';
  if (!ans) {
    const m2 = normalized.match(ANSWER_RX_INLINE);
    if (m2) ans = m2[1] ?? '';
  }
  if (!ans) return undefined;

  const raw0 = ans
    .replace(/[()]/g, ' ')
    .replace(/\boption\b/gi, '')
    .replace(/\s+$/g, '')
    .replace(/[.;,]+$/g, '')
    .trim();

  // Letters like "A", "B and D", compact "AC"
  let letterTokens = (raw0.match(/\b([A-H])\b/gi) || []).map((s) => s.toUpperCase());
  if (letterTokens.length === 0 && /^[A-H]{2,}$/i.test(raw0.replace(/\s+/g, ''))) {
    letterTokens = raw0.replace(/\s+/g, '').toUpperCase().split('');
  }

  // Numbers
  const numberTokens = (raw0.match(/\b([1-9]|10)\b/g) || []).map((s) => parseInt(s, 10));

  // Text tokens if no letters/numbers
  const textTokens =
    letterTokens.length || numberTokens.length
      ? []
      : raw0.split(/(?:,|;|&|\band\b|\bor\b|\/)+/i).map((t) => t.trim()).filter(Boolean);

  const dedup = <T,>(arr: T[]) => Array.from(new Set(arr));
  const norm = (s: string) => normalize(s);
  const normOpts = opts.map(norm);

  const mapLetter = (L: string) => {
    const idx = 'ABCDEFGH'.indexOf(L);
    return idx >= 0 ? (opts[idx] ?? null) : null;
  };
  const mapNumber = (n: number) => (n >= 1 && n <= opts.length ? opts[n - 1] : null);
  const mapText = (t: string) => {
    const nT = norm(t);
    let i = normOpts.findIndex((o) => o === nT);
    if (i !== -1) return opts[i];
    i = normOpts.findIndex((o) => o.includes(nT) || nT.includes(o));
    return i !== -1 ? opts[i] : null;
  };

  let mapped: string[] = [];
  if (opts.length) {
    if (letterTokens.length) {
      mapped = dedup(letterTokens.map(mapLetter).filter((x): x is string => !!x));
    } else if (numberTokens.length) {
      mapped = dedup(numberTokens.map(mapNumber).filter((x): x is string => !!x));
    } else if (textTokens.length) {
      mapped = dedup(textTokens.map(mapText).filter((x): x is string => !!x));
    }
  }

  if (mapped.length > 1) return mapped;
  if (mapped.length === 1) return mapped[0];
  return undefined;
}

/* ────────────────────────────────
   LOCAL PARSER (fallback-first)
────────────────────────────────── */
function simpleExtract(block: string):
  | {
      questionText: string;
      options: string[];
      correctAnswer?: string | string[];
      questionType: 'mcq' | 'checkbox';
    }
  | null {
  const lines = block.replace(/\r\n/g, '\n').split('\n');

  const optionRe = OPT_LINE_RE;

  const opts: string[] = [];
  const stem: string[] = [];
  let optionsStarted = false;

  for (const ln of lines) {
    const m = ln.match(optionRe);
    if (m) {
      optionsStarted = true;
      opts.push(m[3].trim());
    } else if (!optionsStarted) {
      if (/certyiq/i.test(ln)) continue; // ignore watermark in stem
      stem.push(ln);
    }
  }

  // Build question text & clean prefixes
  let questionText = stem.join(' ').replace(/\s+/g, ' ').trim();
  questionText = questionText
    .replace(/^(?:question|q)\s*\d*[:.)-]?\s*/i, '')
    .replace(/^\d+\s*[:.)-]\s*/, '')
    .trim();

  if (!questionText) return null;

  // Try to derive answer from the raw block
  const derived = deriveAnswerFromBlock(block, opts);

  const questionType: 'mcq' | 'checkbox' =
    Array.isArray(derived) ? 'checkbox' : 'mcq';

  return { questionText, options: opts, correctAnswer: derived, questionType };
}

/* ────────────────────────────────
   UTILS
────────────────────────────────── */
function isArabic(s: string) {
  return /[\u0600-\u06FF]/.test(s);
}

function normalize(s: string) {
  return s.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
