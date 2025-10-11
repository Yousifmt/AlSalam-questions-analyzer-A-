// لا تضع "use server" في هذا الملف

export const CORE1_CHAPTERS = [
  'Chapter 1: Summarizing Fundamental Security Concepts',
  'Chapter 2: Comparing Threat Types',
  'Chapter 3: Explaining Appropriate Cryptographic Solutions',
  'Chapter 4: Implement Identity and Access Management',
  'Chapter 5: Maintain Enterprise Campus Network Architecture',
  'Chapter 6: Secure Cloud Network Architecture',
  'Chapter 7: Explain Resiliency and Site Security Concepts',
  'Chapter 8: Evaluate Network Security Capabilities',
  'Chapter 9: Explain Vulnerability Management',
  'Chapter 10: Assess Endpoint Security Capabilities',
  'Chapter 11: Enhance Application Security Capabilities',
  'Chapter 12: Explain Alerting and Monitoring Concepts',
  'Chapter 13: Analyze Indicators of Malicious Activity',
  'Chapter 14: Summarize Security Governance Concepts',
  'Chapter 15: Explain Risk Management Processes',
  'Chapter 16: Summarize Data Protection and Compliance Concepts',
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


// نصوص نقطية جاهزة للـ prompts
export const CORE1_BULLETS = (CORE1_CHAPTERS as readonly string[])
  .map((s: string) => `- ${s}`).join('\n');

export const CORE2_BULLETS = (CORE2_MODULES as readonly string[])
  .map((s: string) => `- ${s}`).join('\n');
