'use server';

import {
  parseQuestionsFromText,
  type ParseQuestionsInput,
  type ParseQuestionsOutput,
} from '@/ai/flows/parse-question';

import {
  explainQuestion,
  type ExplainQuestionInput,
  type ExplainQuestionOutput,
} from '@/ai/flows/explain-question';

import {
  findSimilarQuestions,
  type FindSimilarQuestionsInput,
  type FindSimilarQuestionsOutput,
} from '@/ai/flows/find-similar-questions';

import {
  findDuplicateQuestions,
  type FindDuplicateQuestionsInput,
  type FindDuplicateQuestionsOutput,
} from '@/ai/flows/find-duplicate-questions';

// STRICT, core-locked categorizer (numeric module in allowed range)
import { categorizeQuestion } from '@/ai/flows/categorize-question';

import { db } from '@/lib/firebase';
import { collection, doc, writeBatch, deleteDoc, updateDoc } from 'firebase/firestore';
import { type Question } from '@/types';

/* ──────────────────────────────────────────────────────────────
   Parsing / Explaining / Similar / Duplicates
───────────────────────────────────────────────────────────────*/
export async function handleParseQuestions(
  input: ParseQuestionsInput
): Promise<ParseQuestionsOutput> {
  return await parseQuestionsFromText(input);
}

export async function handleExplainQuestion(
  input: ExplainQuestionInput
): Promise<ExplainQuestionOutput> {
  return await explainQuestion(input);
}

export async function handleFindSimilarQuestions(
  input: FindSimilarQuestionsInput
): Promise<FindSimilarQuestionsOutput> {
  return await findSimilarQuestions(input);
}

export async function handleFindDuplicateQuestions(
  input: FindDuplicateQuestionsInput
): Promise<FindDuplicateQuestionsOutput> {
  return await findDuplicateQuestions(input);
}

/* ──────────────────────────────────────────────────────────────
   Categorize (CORE-LOCKED) 
   - Requires question.core to be provided by the UI (core1|core2)
   - Calls strict flow that returns a module number inside that core
   - Converts the number to the exact module title (chapter)
───────────────────────────────────────────────────────────────*/
export async function handleCategorizeQuestion(q: Question): Promise<Question> {
  if (!q) throw new Error('No question provided');

  const { chapter, confidence } = await categorizeQuestion({
    questionText: q.questionText,
    options: q.options,
    correctAnswer: q.correctAnswer,
    core: (q as any).core as 'core1'|'core2' | undefined, // FORCE the active core
    currentChapter: q.chapter,                              // allow “keep” on low confidence
  });

  const finalCore = ((q as any).core ?? 'core1') as 'core1'|'core2';
  const finalChapter =
    confidence != null && confidence < 0.35    // threshold you can tune
      ? (q.chapter || chapter)
      : chapter;

  return {
    ...q,
    core: finalCore,
    chapter: finalChapter,
    subject: q.subject || 'Cyber Security',
  };
}


/* ──────────────────────────────────────────────────────────────
   Save new questions
   - DOES NOT force core. Whatever comes from client is saved.
   - Adds id/createdAt/updatedAt.
───────────────────────────────────────────────────────────────*/
export async function handleSaveQuestions(
  questions: ParseQuestionsOutput
): Promise<{ success: boolean; savedQuestions: Question[] }> {
  if (!questions || questions.length === 0) {
    return { success: false, savedQuestions: [] };
  }

  try {
    const batch = writeBatch(db);
    const questionsCollection = collection(db, 'questions');
    const nowIso = new Date().toISOString();

    const saved: Question[] = [];

    questions.forEach((q) => {
      const docRef = doc(questionsCollection);
      const toSave: Question = {
        ...(q as Omit<Question, 'id' | 'createdAt' | 'updatedAt'>),
        id: docRef.id,
        createdAt: nowIso,
        updatedAt: nowIso,
        // IMPORTANT: do NOT override core; trust what UI sends (may be undefined if user didn't pick)
        core: (q as any).core as 'core1' | 'core2' | undefined,
      };
      batch.set(docRef, toSave);
      saved.push(toSave);
    });

    await batch.commit();
    return { success: true, savedQuestions: saved };
  } catch (error) {
    console.error('Error saving to Firestore', error);
    return { success: false, savedQuestions: [] };
  }
}

/* ──────────────────────────────────────────────────────────────
   Delete
───────────────────────────────────────────────────────────────*/
export async function handleDeleteQuestion(
  questionId: string
): Promise<{ success: boolean }> {
  if (!questionId) {
    console.error('Delete failed: No question ID provided.');
    return { success: false };
  }

  try {
    const docRef = doc(db, 'questions', questionId);
    await deleteDoc(docRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting question from Firestore', error);
    return { success: false };
  }
}

/* ──────────────────────────────────────────────────────────────
   Batch update
   - Preserves core as provided; NO defaulting to core1
   - Adds updatedAt
───────────────────────────────────────────────────────────────*/
export async function handleUpdateMultipleQuestions(
  questions: Question[]
): Promise<{ success: boolean }> {
  if (!questions || questions.length === 0) {
    console.error('Update failed: No questions provided.');
    return { success: false };
  }

  try {
    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();

    questions.forEach((q) => {
      const docRef = doc(db, 'questions', q.id);
      const { id, ...rest } = q;
      batch.update(docRef, { ...rest, updatedAt: nowIso });
    });

    await batch.commit();
    return { success: true };
  } catch (error) {
    console.error('Error updating multiple questions in Firestore', error);
    return { success: false };
  }
}

/* ──────────────────────────────────────────────────────────────
   Single update
   - Preserves core; NO default to core1
───────────────────────────────────────────────────────────────*/
export async function handleUpdateQuestion(question: Question): Promise<{ success: boolean }> {
  if (!question || !question.id) {
    console.error('Update failed: No question or question ID provided.');
    return { success: false };
  }
  try {
    const questionRef = doc(db, 'questions', question.id);
    const { id, ...rest } = question;
    await updateDoc(questionRef, { ...rest, updatedAt: new Date().toISOString() });
    return { success: true };
  } catch (error) {
    console.error('Error updating question in Firestore', error);
    return { success: false };
  }
}
