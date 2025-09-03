import { config } from 'dotenv';
config();

import '@/ai/flows/find-similar-questions.ts';
import '@/ai/flows/parse-question.ts';
import '@/ai/flows/explain-question.ts';
import '@/ai/flows/categorize-question.ts';
