import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { orgIdFromCtx, zukoFetch } from '../lib/zuko-client';

export default defineTool({
  description:
    'List tasks in the organization with optional pagination and filtering.',
  inputSchema: z.object({
    page: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Page number (default 1)'),
    limit: z
      .number()
      .int()
      .positive()
      .max(100)
      .optional()
      .describe('Items per page (default 50)'),
    parentId: z
      .number()
      .int()
      .nullable()
      .optional()
      .describe('Filter by parent task id; null for root-level tasks only'),
    search: z
      .string()
      .min(1)
      .optional()
      .describe('Search by task title; omit to return all'),
  }),
  async execute(input, ctx) {
    const params = new URLSearchParams();
    if (input.page !== undefined) params.set('page', String(input.page));
    if (input.limit !== undefined) params.set('limit', String(input.limit));
    if (input.parentId !== undefined)
      params.set(
        'parentId',
        input.parentId === null ? 'null' : String(input.parentId),
      );
    if (input.search !== undefined) params.set('search', input.search);
    const qs = params.toString();
    return zukoFetch(
      'GET',
      `/tasks${qs ? `?${qs}` : ''}`,
      undefined,
      orgIdFromCtx(ctx),
    );
  },
});
