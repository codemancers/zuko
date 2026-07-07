import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { zukoFetch } from '../lib/zuko-client';

export default defineTool({
  description:
    "Query contacts in the Zuko CRM with filters. Use aggregation 'count' for counting questions, 'list' (default) to fetch records.",
  inputSchema: z.object({
    filters: z
      .object({
        contactIds: z.array(z.number().int()).optional(),
        ownerId: z.number().int().optional(),
        search: z
          .string()
          .optional()
          .describe('Free-text search over name/email'),
        hasEmail: z.boolean().optional(),
        createdAfter: z.string().optional().describe('ISO 8601 date'),
        createdBefore: z.string().optional().describe('ISO 8601 date'),
      })
      .optional(),
    aggregation: z.enum(['count', 'list']).optional(),
    groupBy: z.enum(['ownerId']).optional(),
    limit: z
      .number()
      .int()
      .positive()
      .max(1000)
      .optional()
      .describe('Max records returned (default 100, max 1000)'),
  }),
  async execute(input) {
    // The backend counts the fetched page, so `limit` (default 100) silently
    // truncates count aggregations — force the maximum there.
    const payload =
      input.aggregation === 'count' ? { ...input, limit: 1000 } : input;
    return zukoFetch('POST', '/contacts/query', payload);
  },
});
