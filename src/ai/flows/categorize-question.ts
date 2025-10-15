// src\ai\flows\categorize-question.ts
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { CORE1_MODULES, CORE2_MODULES } from './core-taxonomy';

/* ---------------- Types ---------------- */
const InputSchema = z.object({
  questionText: z.string(),
  options: z.array(z.string()).optional(),
  correctAnswer: z.union([z.string(), z.array(z.string())]).optional(),
  core: z.enum(['core1', 'core2']).optional(),      // force core if provided
  currentChapter: z.string().optional(),            // keep if low confidence
});
export type CategorizeQuestionInput = z.infer<typeof InputSchema>;

const OutputSchema = z.object({
  chapter: z.string(),
  confidence: z.number().min(0).max(1).optional(),
});
export type CategorizeQuestionOutput = z.infer<typeof OutputSchema>;

/* -------------- Prompt (ranking) -------------- */
const rankModulesPrompt = ai.definePrompt({
  name: 'rankModulesPrompt',
  input: {
    schema: z.object({
      questionText: z.string(),
      options: z.array(z.string()).optional(),
      correctAnswer: z.union([z.string(), z.array(z.string())]).optional(),
      allowed: z.array(z.string()),
    }),
  },
  output: {
    schema: z.object({
      bestModule: z.string(),
      scores: z.array(z.object({ module: z.string(), score: z.number() })).optional(),
    }),
  },
  prompt: `
Rank which single module best matches this question.
Return JSON: {"bestModule":"<one of allowed>","scores":[{"module":"<allowed[i]>","score":0..1},...]}

Rules:
- "bestModule" MUST be exactly one of Allowed.
- Score reflects semantic fit (0=not relevant, 1=perfect).
- Consider stem + options + correct answer (if given).
- Prefer specific over generic matches.

Allowed:
{{#each allowed}}
- {{this}}
{{/each}}

Question: {{{questionText}}}
{{#if options}}Options: {{{options}}}{{/if}}
{{#if correctAnswer}}Correct Answer: {{{correctAnswer}}}{{/if}}
`,
});

/* -------------- Lightweight keyword fallback -------------- */
const KEYWORDS: Record<'core1' | 'core2', Record<string, string[]>> = {
  core1: {
    'Module 1: What Does an IT Specialist Do?': ['roles', 'ethics', 'safety', 'communication', 'ticketing', 'sla'],
    'Module 2: Installing Motherboards and Connectors': ['motherboard', 'socket', 'chipset', 'bios', 'uefi', 'connector'],
    'Module 3: Installing System Devices': ['ram', 'ssd', 'nvme', 'hdd', 'gpu', 'psu', 'cooling'],
    'Module 4: Troubleshooting PC Hardware': ['post', 'beep', 'overheating', 'no boot', 'diagnostics'],
    'Module 5: Comparing Local Networking Hardware': ['switch', 'router', 'nic', 'ethernet', 'access point', 'cable'],
    'Module 6: Configuring Network Addressing and Internet Connections': ['ip', 'subnet', 'gateway', 'dns', 'dhcp', 'pppoe'],
    'Module 7: Supporting Network Services': ['vpn', 'dns server', 'dhcp scope', 'ports', 'services'],
    'Module 8: Summarizing Virtualization and Cloud Concepts': ['vm', 'hypervisor', 'container', 'iaas', 'paas', 'saas'],
    'Module 9: Supporting Mobile Devices': ['smartphone', 'tablet', 'bluetooth', 'tethering', 'mdm'],
    'Module 10: Supporting Print Devices': ['printer', 'toner', 'drum', 'fuser', 'spooler', 'print queue'],
  },
  core2: {
    'Module 11: Managing Support Procedures': ['ticket', 'escalation', 'sop', 'kb', 'documentation', 'warranty'],
    'Module 12: Configuring Windows': ['control panel', 'settings', 'registry', 'gpo', 'powershell', 'user accounts'],
    'Module 13: Managing Windows': ['task manager', 'services', 'event viewer', 'device manager', 'performance'],
    'Module 14: Supporting Windows': ['safe mode', 'startup repair', 'bsod', 'system restore', 'troubleshoot'],
    'Module 15: Securing Windows': ['bitlocker', 'windows defender', 'uac', 'firewall', 'ntfs permissions'],
    'Module 16: Installing Operating Systems': ['install', 'image', 'boot', 'uefi', 'mbr', 'answer file', 'sysprep'],
    'Module 17: Supporting Other OS': ['linux', 'macos', 'brew', 'apt', 'bash', 'dmg', 'pkg'],
    'Module 18: Configuring SOHO Network Security': ['soho', 'ssid', 'wpa2', 'port forwarding', 'nat', 'upnp'],
    'Module 19: Managing Security Settings': ['policy', 'password', 'mfa', 'audit', 'hardening', 'baseline'],
    'Module 20: Supporting Mobile Software': ['apk', 'mdm', 'ios', 'play store', 'app store', 'profiles'],
    'Module 21: Using Data Security': ['backup', 'restore', 'retention', 'drm', 'classification', 'pii'],
    'Module 22: Implementing Operational Procedures': ['msds', 'safety', 'change management', 'inventory', 'disposal'],
  },
};

function norm(s: string) {
  return s.toLowerCase().normalize('NFKC');
}

function scoreByKeywords(text: string, core: 'core1'|'core2', allowed: string[]) {
  const T = norm(text);
  const table = KEYWORDS[core];
  let best = '';
  let bestScore = -1;

  for (const mod of allowed) {
    const kws = table[mod] ?? [];
    const hits = kws.reduce((acc, k) => acc + (T.includes(k) ? 1 : 0), 0);
    if (hits > bestScore) { bestScore = hits; best = mod; }
  }
  return { best, score: bestScore <= 0 ? 0 : Math.min(1, bestScore / 5) };
}

/* -------------- Tiny core guess (only used if core not forced) -------------- */
function heuristicCoreGuess(input: CategorizeQuestionInput): 'core1'|'core2' {
  const t = norm(
    [
      input.questionText,
      ...(input.options ?? []),
      ...(Array.isArray(input.correctAnswer)
        ? input.correctAnswer
        : input.correctAnswer
        ? [input.correctAnswer]
        : []),
    ].join(' ')
  );
  const c2 = [
    'windows','powershell','registry','gpo','driver','update','bitlocker',
    'linux','macos','android','ios','soho','ticket','sop','vpn','mfa',
    'install','boot','uefi'
  ];
  return c2.some(k => t.includes(k)) ? 'core2' : 'core1';
}

/* -------------- Main API -------------- */
export async function categorizeQuestion(
  input: CategorizeQuestionInput
): Promise<CategorizeQuestionOutput> {
  const core: 'core1'|'core2' = input.core ?? heuristicCoreGuess(input);

  // IMPORTANT: widen to string[] so .includes(string) is OK
  const allowedRO = core === 'core1' ? CORE1_MODULES : CORE2_MODULES;
  const allowed: string[] = [...allowedRO];

  let best = '';
  let conf = 0;

  // 1) Ask the model to rank within the forced core’s allowed list
  try {
    const { output } = await rankModulesPrompt({
      questionText: input.questionText,
      options: input.options,
      correctAnswer: input.correctAnswer,
      allowed,
    });
    if (output && output.bestModule && allowed.includes(output.bestModule)) {
      best = output.bestModule;
      const maxScore =
        output.scores?.reduce((m, s) => (typeof s.score === 'number' ? Math.max(m, s.score) : m), 0) ?? 0;
      conf = Math.max(0, Math.min(1, maxScore));
    }
  } catch {
    // ignore; will use fallback
  }

  // 2) Deterministic keyword fallback if the LLM didn’t return a valid module
  if (!best) {
    const fb = scoreByKeywords(
      [input.questionText, ...(input.options ?? [])].join(' '),
      core,
      allowed
    );
    if (fb.best && allowed.includes(fb.best)) {
      best = fb.best;
      conf = Math.max(conf, fb.score);
    }
  }

  // 3) If still nothing, keep current chapter if it belongs to this core.
  if (!best) {
    const keep = input.currentChapter && allowed.includes(input.currentChapter)
      ? input.currentChapter
      : null;
    if (keep) {
      best = keep;
      conf = Math.max(conf, 0.4);
    }
  }

  // 4) Last resort — pick a middle item to avoid collapsing to first.
  if (!best) {
    best = allowed[Math.floor(allowed.length / 2)];
    conf = Math.max(conf, 0.3);
  }

  return { chapter: best, confidence: conf };
}
