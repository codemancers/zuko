import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { zukoFetch } from '../lib/zuko-client';

export default defineTool({
  description: 'Update an existing task by ID.',
  inputSchema: z.object({
    id: z.number().int().positive().describe('Task ID to update'),
    title: z.string().optional().describe('New title'),
    description: z.string().optional().describe('New plain-text description'),
    status: z
      .enum(['TODO', 'IN_PROGRESS', 'DONE'])
      .optional()
      .describe('New status'),
    assignee: z
      .string()
      .nullable()
      .optional()
      .describe('New assignee user ID; null to unassign'),
    completedAt: z
      .string()
      .nullable()
      .optional()
      .describe('ISO 8601 completion timestamp; null to clear'),
  }),
  async execute({ id, ...dto }, ctx) {
    return zukoFetch('PATCH', `/tasks/${id}`, dto, ctx);
  },
});
