import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { zukoFetch } from '../lib/zuko-client';

export default defineTool({
  description: 'Create a new task.',
  inputSchema: z.object({
    title: z.string().min(1).describe('Task title'),
    description: z.string().optional().describe('Plain-text description'),
    status: z
      .enum(['todo', 'in_progress', 'done'])
      .optional()
      .default('todo')
      .describe('Initial status'),
    parentId: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Parent task ID for subtasks'),
    assignee: z.string().optional().describe('Assignee user ID (string)'),
  }),
  async execute(input) {
    return zukoFetch('POST', '/tasks', input);
  },
});
