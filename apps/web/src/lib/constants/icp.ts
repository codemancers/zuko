import type { MultiSelectOption } from '@zuko/ui-kit';

export const INDUSTRY_OPTIONS: MultiSelectOption[] = [
  { label: 'SaaS', value: 'saas' },
  { label: 'Fintech', value: 'fintech' },
  { label: 'Healthcare', value: 'healthcare' },
  { label: 'E-commerce', value: 'ecommerce' },
  { label: 'Marketing', value: 'marketing' },
  { label: 'Finance', value: 'finance' },
  { label: 'Education', value: 'education' },
  { label: 'Media', value: 'media' },
  { label: 'Retail', value: 'retail' },
  { label: 'Manufacturing', value: 'manufacturing' },
  { label: 'Real Estate', value: 'real estate' },
  { label: 'Logistics', value: 'logistics' },
  { label: 'Cybersecurity', value: 'cybersecurity' },
  { label: 'AI / ML', value: 'artificial intelligence' },
  { label: 'Legal', value: 'legal' },
  { label: 'Insurance', value: 'insurance' },
  { label: 'Consulting', value: 'consulting' },
  { label: 'Telecommunications', value: 'telecommunications' },
];

export const EMPLOYEE_RANGE_OPTIONS: MultiSelectOption[] = [
  { label: '1 – 10', value: '1,10' },
  { label: '11 – 50', value: '11,50' },
  { label: '51 – 200', value: '51,200' },
  { label: '201 – 500', value: '201,500' },
  { label: '501 – 1,000', value: '501,1000' },
  { label: '1,001 – 5,000', value: '1001,5000' },
  { label: '5,001 – 10,000', value: '5001,10000' },
  { label: '10,001+', value: '10001,' },
];

/** Lookup map: stored Apollo "min,max" value → human-readable label. */
export const EMPLOYEE_RANGE_LABEL: Record<string, string> = Object.fromEntries(
  EMPLOYEE_RANGE_OPTIONS.map(({ value, label }) => [value, label]),
);
