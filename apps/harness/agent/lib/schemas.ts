import * as z from 'zod';

export const OPERATORS = [
  'EQUALS',
  'NOT_EQUALS',
  'GREATER_THAN',
  'LESS_THAN',
  'GREATER_THAN_OR_EQUAL_TO',
  'LESS_THAN_OR_EQUAL_TO',
  'BETWEEN',
  'IN',
  'NOT_IN',
  'IS_NULL',
  'IS_NOT_NULL',
  'CONTAINS',
  'STARTS_WITH',
  'ENDS_WITH',
] as const;
export const object = z
  .string()
  .describe('Singular object type name, e.g. "deal". See list_object_types.');
export const recordId = z.string().describe('Record id (a string of digits).');
export const commentId = z
  .string()
  .describe('Comment id (a string of digits), from list_comments or get_record_activity.');
export const commentBody = z
  .string()
  .min(1)
  .max(10000)
  .describe('The comment, in markdown, at most 10,000 characters.');
export const mentions = z
  .array(z.string())
  .max(20)
  .optional()
  .describe(
    'Member user ids from list_members to mention. Each must be able to see the record, or the call is refused.',
  );
export const pageBefore = z
  .string()
  .optional()
  .describe('The next_before value of the previous page, to read the items before it.');
export const pageLimit = z
  .number()
  .int()
  .min(1)
  .max(100)
  .optional()
  .describe('Items per page (default 50).');
export const link = z
  .string()
  .describe(
    'The link\'s name, from the "associations" in describe_object_type, e.g. "contact_company" or "deal_primary_contact".',
  );
export const sortParam = z
  .string()
  .optional()
  .describe('"field,asc" or "field,desc"; created_at, updated_at or a filterable field.');
export const assignee = z
  .string()
  .nullable()
  .optional()
  .describe('Member user id from list_members; null leaves it unassigned.');

export const filterGroups = z
  .array(
    z.object({
      logical_operator: z
        .enum(['AND', 'OR'])
        .optional()
        .describe('How filters in this group combine (default AND). Groups combine with OR.'),
      filters: z.array(
        z.object({
          field_path: z
            .string()
            .describe('A filterable field, or id, owner_id, team_id, created_at, updated_at.'),
          operator: z.enum(OPERATORS),
          value: z.unknown().optional().describe('For single-value operators.'),
          values: z
            .array(z.unknown())
            .optional()
            .describe('For IN, NOT_IN and BETWEEN (two values).'),
        }),
      ),
    }),
  )
  .optional();
