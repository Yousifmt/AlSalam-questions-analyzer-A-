
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
  categorizeQuestion,
} from '@/ai/flows/categorize-question';


import { db } from '@/lib/firebase';
import { collection, doc, writeBatch, deleteDoc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL, deleteObject } from "firebase/storage";
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
    subject: "Cyber Security", // The prompt always uses this subject, so we set it here.
  };

  // This function now only returns the updated question data without saving it.
  // The calling function is responsible for saving.
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
      const docRef = doc(questionsCollection); // Automatically generate new doc ID
      const questionData: Question = {
        ...(question as Omit<Question, 'id' | 'createdAt' | 'updatedAt'>),
        id: docRef.id,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
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
    // Note: This does not delete associated images from storage.
    // A more robust solution would involve a Cloud Function to handle deletions.
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
            // Create a new object for the update to avoid modifying the original
            const dataToUpdate = { ...q, updatedAt: now };
            // The document ID is part of the reference, not the data itself
            delete (dataToUpdate as any).id;
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
        const dataToUpdate = { ...question };
        
        delete (dataToUpdate as any).id;

        await updateDoc(questionRef, {
            ...dataToUpdate,
            updatedAt: now.toISOString(),
        });
        return { success: true };
    } catch(error) {
        console.error('Error updating question in Firestore', error);
        return { success: false };
    }
}
