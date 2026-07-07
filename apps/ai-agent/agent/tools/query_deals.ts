import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { zukoFetch } from '../lib/zuko-client';

export default defineTool({
  description:
    "Query deals in the Zuko CRM with filters. Use aggregation 'count' for counting questions, groupBy 'stage' to discover pipeline stages.",
  inputSchema: z.object({
    filters: z
      .object({
        dealIds: z.array(z.number().int()).optional(),
        ownerId: z.number().int().optional(),
        stages: z.array(z.string()).optional(),
        minValue: z.number().optional(),
        maxValue: z.number().optional(),
        expectedCloseFrom: z.string().optional().describe('ISO 8601 date'),
        expectedCloseTo: z.string().optional().describe('ISO 8601 date'),
        companyId: z.number().int().optional(),
        contactId: z.number().int().optional(),
        search: z.string().optional().describe('Free-text search over title'),
        createdAfter: z.string().optional().describe('ISO 8601 date'),
        createdBefore: z.string().optional().describe('ISO 8601 date'),
      })
      .optional(),
    aggregation: z.enum(['count', 'list']).optional(),
    groupBy: z.enum(['stage', 'ownerId']).optional(),
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
    return zukoFetch('POST', '/deals/query', payload);
  },
});
