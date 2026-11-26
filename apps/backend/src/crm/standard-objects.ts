import type { FieldType } from './field-types';

export interface StandardField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  filterable?: boolean;
  maxLength?: number;
  /** For ENUM fields. */
  options?: string[];
  /** For FILE fields: whether the field holds several files. */
  many?: boolean;
}

export interface StandardObject {
  slug: string;
  label: string;
  pluralLabel: string;
  fields: StandardField[];
}

/**
 * The objects every CRM organization starts with. They are ordinary object types (kind
 * STANDARD): admins can add fields to them like any other.
 *
 * Records link to each other through associations (see STANDARD_ASSOCIATIONS), not through
 * text fields that name each other.
 */
export const STANDARD_OBJECTS: readonly StandardObject[] = [
  {
    slug: 'contact',
    label: 'Contact',
    pluralLabel: 'Contacts',
    fields: [
      { name: 'first_name', label: 'First name', type: 'TEXT', required: true, filterable: true, maxLength: 100 },
      { name: 'last_name', label: 'Last name', type: 'TEXT', filterable: true, maxLength: 100 },
      { name: 'email', label: 'Email', type: 'EMAIL', unique: true, filterable: true },
      { name: 'phone', label: 'Phone', type: 'TEXT', maxLength: 50 },
      { name: 'job_title', label: 'Job title', type: 'TEXT', filterable: true, maxLength: 100 },
      {
        name: 'lifecycle_stage',
        label: 'Lifecycle stage',
        type: 'ENUM',
        filterable: true,
        options: ['subscriber', 'lead', 'qualified', 'customer', 'churned'],
      },
    ],
  },
  {
    slug: 'company',
    label: 'Company',
    pluralLabel: 'Companies',
    fields: [
      { name: 'name', label: 'Name', type: 'TEXT', required: true, filterable: true, maxLength: 200 },
      { name: 'domain', label: 'Website domain', type: 'TEXT', unique: true, filterable: true, maxLength: 200 },
      { name: 'industry', label: 'Industry', type: 'TEXT', filterable: true, maxLength: 100 },
      { name: 'employee_count', label: 'Employees', type: 'NUMBER', filterable: true },
      { name: 'city', label: 'City', type: 'TEXT', filterable: true, maxLength: 100 },
      { name: 'annual_revenue', label: 'Annual revenue', type: 'NUMBER' },
      {
        name: 'status',
        label: 'Status',
        type: 'ENUM',
        filterable: true,
        options: ['prospect', 'active', 'customer', 'partner', 'churned'],
      },
    ],
  },
  {
    slug: 'deal',
    label: 'Deal',
    pluralLabel: 'Deals',
    fields: [
      { name: 'name', label: 'Name', type: 'TEXT', required: true, filterable: true, maxLength: 200 },
      { name: 'amount', label: 'Amount', type: 'NUMBER', filterable: true },
      {
        name: 'stage',
        label: 'Stage',
        type: 'ENUM',
        filterable: true,
        options: ['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'],
      },
      { name: 'expected_close_date', label: 'Expected close', type: 'TIMESTAMP', filterable: true },
    ],
  },
  {
    slug: 'prospect',
    label: 'Prospect',
    pluralLabel: 'Prospects',
    fields: [
      { name: 'first_name', label: 'First name', type: 'TEXT', required: true, filterable: true, maxLength: 100 },
      { name: 'last_name', label: 'Last name', type: 'TEXT', filterable: true, maxLength: 100 },
      { name: 'email', label: 'Email', type: 'EMAIL', unique: true, filterable: true },
      { name: 'phone', label: 'Phone', type: 'TEXT', maxLength: 50 },
      { name: 'job_title', label: 'Job title', type: 'TEXT', filterable: true, maxLength: 100 },
      {
        name: 'status',
        label: 'Status',
        type: 'ENUM',
        filterable: true,
        options: ['new', 'researching', 'contacted', 'engaged', 'disqualified', 'converted'],
      },
      { name: 'source', label: 'Source', type: 'TEXT', filterable: true, maxLength: 100 },
    ],
  },
  {
    slug: 'lead',
    label: 'Lead',
    pluralLabel: 'Leads',
    fields: [
      { name: 'first_name', label: 'First name', type: 'TEXT', required: true, filterable: true, maxLength: 100 },
      { name: 'last_name', label: 'Last name', type: 'TEXT', filterable: true, maxLength: 100 },
      { name: 'email', label: 'Email', type: 'EMAIL', unique: true, filterable: true },
      { name: 'phone', label: 'Phone', type: 'TEXT', maxLength: 50 },
      { name: 'job_title', label: 'Job title', type: 'TEXT', filterable: true, maxLength: 100 },
      {
        name: 'status',
        label: 'Status',
        type: 'ENUM',
        filterable: true,
        options: ['new', 'contacted', 'qualified', 'disqualified', 'converted'],
      },
      { name: 'source', label: 'Source', type: 'TEXT', filterable: true, maxLength: 100 },
      { name: 'score', label: 'Score', type: 'NUMBER', filterable: true },
      { name: 'ai_summary', label: 'AI summary', type: 'TEXT', maxLength: 2000 },
    ],
  },
  {
    slug: 'campaign',
    label: 'Campaign',
    pluralLabel: 'Campaigns',
    fields: [
      { name: 'name', label: 'Name', type: 'TEXT', required: true, filterable: true, maxLength: 200 },
      {
        name: 'status',
        label: 'Status',
        type: 'ENUM',
        filterable: true,
        options: ['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled'],
      },
      {
        name: 'type',
        label: 'Type',
        type: 'ENUM',
        filterable: true,
        options: ['email', 'event', 'outbound', 'content', 'other'],
      },
      { name: 'start_date', label: 'Start date', type: 'TIMESTAMP', filterable: true },
      { name: 'end_date', label: 'End date', type: 'TIMESTAMP', filterable: true },
      { name: 'budget', label: 'Budget', type: 'NUMBER', filterable: true },
      { name: 'spent', label: 'Spent', type: 'NUMBER' },
      { name: 'goal', label: 'Goal', type: 'TEXT', maxLength: 500 },
      { name: 'description', label: 'Description', type: 'TEXT', maxLength: 2000 },
      { name: 'assets', label: 'Assets', type: 'FILE', many: true },
    ],
  },
];

/**
 * The links between the standard objects. Each is a link field on `source` (so it is a column
 * there, and can be edited or removed like any field) and shows on `target` under `reverseLabel`.
 * Many on each side, as any link can be.
 */
export const STANDARD_ASSOCIATIONS: readonly {
  name: string;
  label: string;
  source: string;
  target: string;
  field: string;
  fieldLabel: string;
  reverseLabel: string;
  /** Whether a source record links to many targets (the default) or at most one. */
  many?: boolean;
}[] = [
  { name: 'contact_company', label: 'Contact and company', source: 'contact', target: 'company', field: 'companies', fieldLabel: 'Companies', reverseLabel: 'Contacts' },
  { name: 'contact_deal', label: 'Contact and deal', source: 'contact', target: 'deal', field: 'deals', fieldLabel: 'Deals', reverseLabel: 'Contacts' },
  { name: 'deal_company', label: 'Deal and company', source: 'deal', target: 'company', field: 'companies', fieldLabel: 'Companies', reverseLabel: 'Deals' },
  { name: 'prospect_company', label: 'Prospect and company', source: 'prospect', target: 'company', field: 'companies', fieldLabel: 'Companies', reverseLabel: 'Prospects' },
  { name: 'lead_company', label: 'Lead and company', source: 'lead', target: 'company', field: 'companies', fieldLabel: 'Companies', reverseLabel: 'Leads' },
  // Where a prospect or lead went once it moved on; filled in when it converts.
  { name: 'prospect_lead', label: 'Prospect and lead', source: 'prospect', target: 'lead', field: 'converted_lead', fieldLabel: 'Converted to lead', reverseLabel: 'Prospects', many: false },
  { name: 'lead_contact', label: 'Lead and contact', source: 'lead', target: 'contact', field: 'converted_contact', fieldLabel: 'Converted to contact', reverseLabel: 'Leads', many: false },
  // Who a campaign reaches. The person is the source so a campaign with thousands of members
  // has no column listing them all; the campaign shows them under `reverseLabel`.
  { name: 'prospect_campaign', label: 'Prospect and campaign', source: 'prospect', target: 'campaign', field: 'campaigns', fieldLabel: 'Campaigns', reverseLabel: 'Prospects' },
  { name: 'lead_campaign', label: 'Lead and campaign', source: 'lead', target: 'campaign', field: 'campaigns', fieldLabel: 'Campaigns', reverseLabel: 'Leads' },
  { name: 'contact_campaign', label: 'Contact and campaign', source: 'contact', target: 'campaign', field: 'campaigns', fieldLabel: 'Campaigns', reverseLabel: 'Contacts' },
  { name: 'company_campaign', label: 'Company and campaign', source: 'company', target: 'campaign', field: 'campaigns', fieldLabel: 'Campaigns', reverseLabel: 'Companies' },
  // Deals a campaign is credited with, for attribution.
  { name: 'deal_campaign', label: 'Deal and campaign', source: 'deal', target: 'campaign', field: 'campaigns', fieldLabel: 'Campaigns', reverseLabel: 'Deals' },
];
