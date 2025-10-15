// src\lib\taxonomy-utils.ts

import { CORE1_MODULES, CORE2_MODULES } from '@/ai/flows/core-taxonomy';

export type Core = 'core1' | 'core2';

export const ALLOWED: Record<Core, readonly string[]> = {
  core1: CORE1_MODULES,
  core2: CORE2_MODULES,
};

export function moduleNumberFromTitle(title: string): number | null {
  const m = title.match(/module\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

export function coreForModuleNumber(n: number | null): Core | null {
  if (n == null || Number.isNaN(n)) return null;
  if (n >= 1 && n <= 10) return 'core1';
  if (n >= 11 && n <= 22) return 'core2';
  return null;
}

export function pickChapterByModuleNumber(core: Core, n: number): string | null {
  const list = ALLOWED[core];
  const title = list.find(s => moduleNumberFromTitle(s) === n) || null;
  return title ?? null;
}

/** Strict: if module number says "core2" but forcedCore is "core1", we keep the forced core and fall back to the first module of that core. */
export function enforceCoreAndChapter(
  candidateChapter: string,
  forcedCore?: Core
): { core: Core; chapter: string } {
  const n = moduleNumberFromTitle(candidateChapter);
  const inferred = coreForModuleNumber(n);
  let finalCore: Core;
  let finalChapter: string | null;

  if (forcedCore) {
    finalCore = forcedCore;
    // If candidate doesn’t belong to forced core, replace with first module of forced core.
    const belongs = n != null && coreForModuleNumber(n) === forcedCore;
    finalChapter = belongs ? candidateChapter : ALLOWED[forcedCore][0];
  } else {
    finalCore = inferred ?? 'core1';
    // If inferred is null, fall back to first of core1.
    if (inferred == null) {
      finalChapter = ALLOWED['core1'][0];
    } else {
      // Make sure the exact module exists in that core list
      finalChapter = n != null ? pickChapterByModuleNumber(finalCore, n) : null;
      if (!finalChapter) finalChapter = ALLOWED[finalCore][0];
    }
  }

  return { core: finalCore, chapter: finalChapter! };
}

/** Coerce a maybe-off-by-a-bit chapter to an exact list item for a given core. */
export function coerceChapterToAllowed(core: Core, chapter: string): string {
  const allowed = ALLOWED[core];
  if (allowed.includes(chapter)) return chapter;

  // Case-insensitive exact
  const lower = chapter.toLowerCase();
  const ci = allowed.find(a => a.toLowerCase() === lower);
  if (ci) return ci;

  // By module number
  const n = moduleNumberFromTitle(chapter);
  if (n != null) {
    const byNum = pickChapterByModuleNumber(core, n);
    if (byNum) return byNum;
  }

  // Fallback
  return allowed[0];
}
