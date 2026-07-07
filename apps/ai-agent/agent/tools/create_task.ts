import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { zukoFetch } from '../lib/zuko-client';

export default defineTool({
  description: 'Create a new task.',
  inputSchema: z.object({
    title: z.string().min(1).describe('Task title'),
    description: z.string().optional().describe('Plain-text description'),
    status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional().default('TODO').describe('Initial status'),
    assignee: z.string().optional().describe('Assignee user ID (string)'),
  }),
  async execute(input, ctx) {
    return zukoFetch('POST', '/tasks', input, ctx);
  },
});
