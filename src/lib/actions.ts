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

import {
  categorizeQuestion,
} from '@/ai/flows/categorize-question';

import { db } from '@/lib/firebase';
import { collection, doc, writeBatch, deleteDoc, updateDoc } from 'firebase/firestore';
import { type Question } from '@/types';

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

export async function handleCategorizeQuestion(
  question: Question
): Promise<Question> {
  if (!question) {
    throw new Error("No question provided to categorize.");
  }

  const result = await categorizeQuestion({
    questionText: question.questionText,
    options: question.options,
    correctAnswer: question.correctAnswer,
  });

  if (!result || !result.chapter) {
    throw new Error("AI failed to determine a chapter.");
  }

  const updatedQuestion: Question = {
    ...question,
    chapter: result.chapter,
    subject: "Cyber Security",
    // NEW: لو ما عنده core، ثبّت Core 1 (بناءً على طلبك الحالي)
    core: question.core ?? "core1",
  };

  // نرجّع الداتا فقط — الحفظ يكون عبر handleUpdateQuestion
  return updatedQuestion;
}

export async function handleSaveQuestions(
  questions: ParseQuestionsOutput
): Promise<{ success: boolean; savedQuestions: Question[] }> {
  if (!questions || questions.length === 0) {
    return { success: false, savedQuestions: [] };
  }

  try {
    const batch = writeBatch(db);
    const questionsCollection = collection(db, 'questions');
    const now = new Date();
    const savedQuestions: Question[] = [];

    questions.forEach((question) => {
      const docRef = doc(questionsCollection);
      const questionData: Question = {
        ...(question as Omit<Question, 'id' | 'createdAt' | 'updatedAt'>),
        id: docRef.id,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        // NEW: كل الإضافات الآن تُحفظ Core 1
        core: (question as any).core ?? "core1",
      };
      batch.set(docRef, questionData);
      savedQuestions.push(questionData);
    });

    await batch.commit();
    return { success: true, savedQuestions };
  } catch (error) {
    console.error('Error saving to firestore', error);
    return { success: false, savedQuestions: [] };
  }
}

export async function handleDeleteQuestion(
  questionId: string
): Promise<{ success: boolean }> {
  if (!questionId) {
    console.error("Delete failed: No question ID provided.");
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

export async function handleUpdateMultipleQuestions(questions: Question[]): Promise<{ success: boolean }> {
  if (!questions || questions.length === 0) {
    console.error("Update failed: No questions provided.");
    return { success: false };
  }

  try {
    const batch = writeBatch(db);
    const now = new Date().toISOString();

    questions.forEach(q => {
      const docRef = doc(db, 'questions', q.id);
      const dataToUpdate = { ...q, updatedAt: now };
      delete (dataToUpdate as any).id;
      // NEW: ضمّن core دائمًا (ولو كان null عيّنه core1)
      (dataToUpdate as any).core = (q as any).core ?? "core1";
      batch.update(docRef, dataToUpdate);
    });

    await batch.commit();
    return { success: true };
  } catch (error) {
    console.error('Error updating multiple questions in Firestore', error);
    return { success: false };
  }
}

export async function handleUpdateQuestion(question: Question): Promise<{ success: boolean }> {
  if (!question || !question.id) {
    console.error("Update failed: No question or question ID provided.");
    return { success: false };
  }
  try {
    const questionRef = doc(db, "questions", question.id);
    const now = new Date();
    const dataToUpdate: any = { ...question };
    delete dataToUpdate.id;

    await updateDoc(questionRef, {
      ...dataToUpdate,
      core: dataToUpdate.core ?? "core1", // NEW: ثبّت core1 لو مفقود
      updatedAt: now.toISOString(),
    });
    return { success: true };
  } catch(error) {
    console.error('Error updating question in Firestore', error);
    return { success: false };
  }
}
