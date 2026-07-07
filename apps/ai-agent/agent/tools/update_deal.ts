import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { toEditorData } from '../lib/editor-data';
import { zukoFetch } from '../lib/zuko-client';

export default defineTool({
  description:
    'Update an existing Zuko CRM deal by id. Only provided fields change. Confirm the id with a query first.',
  inputSchema: z.object({
    id: z.number().int().positive().describe('Deal id'),
    title: z.string().min(1).optional(),
    value: z.number().optional(),
    currency: z.string().optional(),
    probability: z.number().min(0).max(100).optional(),
    stage: z.string().optional(),
    summary: z
      .string()
      .optional()
      .describe('Plain-text summary (replaces existing)'),
    expectedCloseDate: z.string().optional().describe('ISO 8601 date'),
    actualCloseDate: z.string().optional().describe('ISO 8601 date'),
    lostReason: z.string().optional(),
    source: z.string().optional(),
    priority: z.number().int().optional(),
  }),
  async execute({ id, summary, ...rest }) {
    return zukoFetch('PATCH', `/deals/${id}`, {
      ...rest,
      summary: summary ? toEditorData(summary) : undefined,
    });
  },
});
