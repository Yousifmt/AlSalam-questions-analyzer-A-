// DO NOT add "use server" here

export const CORE1_MODULES = [
  'Module 1: What Does an IT Specialist Do?',
  'Module 2: Installing Motherboards and Connectors',
  'Module 3: Installing System Devices',
  'Module 4: Troubleshooting PC Hardware',
  'Module 5: Comparing Local Networking Hardware',
  'Module 6: Configuring Network Addressing and Internet Connections',
  'Module 7: Supporting Network Services',
  'Module 8: Summarizing Virtualization and Cloud Concepts',
  'Module 9: Supporting Mobile Devices',
  'Module 10: Supporting Print Devices',
] as const;

export const CORE2_MODULES = [
  'Module 11: Managing Support Procedures',
  'Module 12: Configuring Windows',
  'Module 13: Managing Windows',
  'Module 14: Supporting Windows',
  'Module 15: Securing Windows',
  'Module 16: Installing Operating Systems',
  'Module 17: Supporting Other OS',
  'Module 18: Configuring SOHO Network Security',
  'Module 19: Managing Security Settings',
  'Module 20: Supporting Mobile Software',
  'Module 21: Using Data Security',
  'Module 22: Implementing Operational Procedures',
] as const;

// Prompt bullets (unchanged)
export const CORE1_BULLETS = (CORE1_MODULES as readonly string[]).map(s => `- ${s}`).join('\n');
export const CORE2_BULLETS = (CORE2_MODULES as readonly string[]).map(s => `- ${s}`).join('\n');

// ---------- Helpers you can import ----------
export type Core = 'core1' | 'core2';

export const CORE_RANGES: Record<Core, { min: number; max: number }> = {
  core1: { min: 1, max: 10 },
  core2: { min: 11, max: 22 },
};

export function moduleNumberFromTitle(title: string): number | null {
  const m = title.match(/module\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

export function titleFor(core: Core, moduleNum: number): string {
  const list = core === 'core1' ? CORE1_MODULES : CORE2_MODULES;
  const hit = (list as readonly string[]).find(s => moduleNumberFromTitle(s) === moduleNum);
  return hit ?? list[0];
}
