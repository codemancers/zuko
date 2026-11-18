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
}[] = [
  { name: 'contact_company', label: 'Contact and company', source: 'contact', target: 'company', field: 'companies', fieldLabel: 'Companies', reverseLabel: 'Contacts' },
  { name: 'contact_deal', label: 'Contact and deal', source: 'contact', target: 'deal', field: 'deals', fieldLabel: 'Deals', reverseLabel: 'Contacts' },
  { name: 'deal_company', label: 'Deal and company', source: 'deal', target: 'company', field: 'companies', fieldLabel: 'Companies', reverseLabel: 'Deals' },
];
