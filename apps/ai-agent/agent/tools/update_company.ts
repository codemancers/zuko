import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { toEditorData } from '../lib/editor-data';
import { zukoFetch } from '../lib/zuko-client';

export default defineTool({
  description:
    'Update an existing Zuko CRM company by id. Only provided fields change. Confirm the id with a query first.',
  inputSchema: z.object({
    id: z.number().int().positive().describe('Company id'),
    companyName: z.string().min(1).optional(),
    website: z.string().optional(),
    linkedinUrl: z.string().optional(),
    summary: z
      .string()
      .optional()
      .describe('Plain-text summary (replaces existing)'),
    isHidden: z.boolean().optional(),
  }),
  async execute({ id, summary, ...rest }) {
    return zukoFetch('PATCH', `/companies/${id}`, {
      ...rest,
      summary: summary ? toEditorData(summary) : undefined,
    });
  },
});
