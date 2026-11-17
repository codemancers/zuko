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
 * Contacts and deals name their company as text for now; linking records to each other
 * (associations) has tables but no API yet.
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
      { name: 'company_name', label: 'Company', type: 'TEXT', filterable: true, maxLength: 200 },
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
      { name: 'company_name', label: 'Company', type: 'TEXT', filterable: true, maxLength: 200 },
      { name: 'contact_name', label: 'Contact', type: 'TEXT', maxLength: 200 },
    ],
  },
];
