import { z } from 'zod';
import { defineTool } from './base';

export const todoWriteTool = defineTool({
  name: 'todo_write',
  description:
    "Create or update the agent's running todo list. Each item: { id, content, status }. Use to track multi-step work.",
  schema: z.object({
    todos: z.array(
      z.object({
        id: z.string(),
        content: z.string(),
        status: z.enum(['pending', 'in_progress', 'completed']),
      }),
    ),
  }),
  execute: async ({ todos }) => ({ todos }),
});
