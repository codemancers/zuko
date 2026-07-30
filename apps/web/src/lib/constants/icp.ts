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

export const REGION_OPTIONS: MultiSelectOption[] = [
  { label: 'North America', value: 'north_america' },
  { label: 'Europe', value: 'europe' },
  { label: 'Asia Pacific', value: 'apac' },
  { label: 'Latin America', value: 'latam' },
  { label: 'Middle East & Africa', value: 'mea' },
  { label: 'ANZ', value: 'anz' },
];

export const SUB_INDUSTRY_OPTIONS: MultiSelectOption[] = [
  { label: 'HR Tech', value: 'hr_tech' },
  { label: 'Sales Tech', value: 'sales_tech' },
  { label: 'MarTech', value: 'martech' },
  { label: 'DevTools', value: 'devtools' },
  { label: 'Data & Analytics', value: 'data_analytics' },
  { label: 'Cybersecurity', value: 'cybersecurity' },
  { label: 'HealthTech', value: 'healthtech' },
  { label: 'LegalTech', value: 'legaltech' },
  { label: 'PropTech', value: 'proptech' },
  { label: 'EdTech', value: 'edtech' },
  { label: 'Supply Chain', value: 'supply_chain' },
  { label: 'Payments', value: 'payments' },
  { label: 'InsurTech', value: 'insurtech' },
  { label: 'RegTech', value: 'regtech' },
  { label: 'CleanTech', value: 'cleantech' },
];

export const COMPANY_TYPE_OPTIONS: MultiSelectOption[] = [
  { label: 'B2B', value: 'b2b' },
  { label: 'B2C', value: 'b2c' },
  { label: 'B2B2C', value: 'b2b2c' },
  { label: 'Marketplace', value: 'marketplace' },
  { label: 'Services / Agency', value: 'services' },
  { label: 'Non-profit', value: 'nonprofit' },
  { label: 'Government', value: 'government' },
];

export const REVENUE_STATUS_OPTIONS: MultiSelectOption[] = [
  { label: 'Pre-revenue', value: 'pre_revenue' },
  { label: 'Early Revenue', value: 'early_revenue' },
  { label: 'Growth Stage', value: 'growth' },
  { label: 'Profitable', value: 'profitable' },
  { label: 'Public', value: 'public' },
];

export const FUNDING_STATUS_OPTIONS: MultiSelectOption[] = [
  { label: 'Bootstrapped', value: 'bootstrapped' },
  { label: 'Angel-funded', value: 'angel' },
  { label: 'VC-funded', value: 'vc_funded' },
  { label: 'PE-backed', value: 'pe_backed' },
  { label: 'Public', value: 'public' },
];

export const FUNDING_STAGE_OPTIONS: MultiSelectOption[] = [
  { label: 'Pre-seed', value: 'pre_seed' },
  { label: 'Seed', value: 'seed' },
  { label: 'Series A', value: 'series_a' },
  { label: 'Series B', value: 'series_b' },
  { label: 'Series C', value: 'series_c' },
  { label: 'Series D+', value: 'series_d_plus' },
  { label: 'Growth / Late Stage', value: 'growth' },
  { label: 'IPO / Public', value: 'ipo' },
];

const SCORE_OPTIONS: MultiSelectOption[] = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
];

export const WORKFLOW_COMPLEXITY_OPTIONS = SCORE_OPTIONS;
export const AUTOMATION_OPPORTUNITY_OPTIONS = SCORE_OPTIONS;
export const BUDGET_LIKELIHOOD_OPTIONS = SCORE_OPTIONS;
export const CONSULTING_FIT_OPTIONS = SCORE_OPTIONS;

export const AI_TRANSFORMATION_SIGNAL_OPTIONS: MultiSelectOption[] = [
  { label: 'None', value: 'none' },
  ...SCORE_OPTIONS,
];

export const OPERATIONAL_BOTTLENECK_OPTIONS: MultiSelectOption[] = [
  { label: 'Manual Data Entry', value: 'manual_data_entry' },
  { label: 'Poor Integrations', value: 'poor_integrations' },
  { label: 'Siloed Teams', value: 'siloed_teams' },
  { label: 'Slow Reporting', value: 'slow_reporting' },
  { label: 'Compliance Overhead', value: 'compliance_overhead' },
  { label: 'Talent Shortage', value: 'talent_shortage' },
  { label: 'High Churn', value: 'high_churn' },
  { label: 'Scaling Issues', value: 'scaling_issues' },
];

export const PRODUCT_MATURITY_OPTIONS: MultiSelectOption[] = [
  { label: 'Early Stage', value: 'early' },
  { label: 'Growth', value: 'growth' },
  { label: 'Mature', value: 'mature' },
  { label: 'Legacy', value: 'legacy' },
];
