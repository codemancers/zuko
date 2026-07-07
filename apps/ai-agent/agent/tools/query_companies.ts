import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { zukoFetch } from '../lib/zuko-client';

export default defineTool({
  description:
    "Query companies in the Zuko CRM with filters. Use aggregation 'count' for counting questions, 'list' (default) to fetch records.",
  inputSchema: z.object({
    filters: z
      .object({
        search: z
          .string()
          .optional()
          .describe('Free-text search over company name/website'),
        ownerId: z.number().int().optional(),
        companyIds: z.array(z.number().int()).optional(),
        hasWebsite: z.boolean().optional(),
        contactCountMin: z.number().int().optional(),
        contactCountMax: z.number().int().optional(),
        createdAfter: z.string().optional().describe('ISO 8601 date'),
        createdBefore: z.string().optional().describe('ISO 8601 date'),
      })
      .optional(),
    aggregation: z.enum(['count', 'list']).optional(),
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
    return zukoFetch('POST', '/companies/query', payload);
  },
});
